import { GoogleGenAI, Type } from "@google/genai";
import { ItemType, BrainDumpItem } from "../types";

const GEMINI_SETTINGS_KEY = "braindump_gemini_key";

export const getGeminiKey = (): string => {
  return localStorage.getItem(GEMINI_SETTINGS_KEY) || process.env.API_KEY || "";
};

export const saveGeminiKey = (key: string) => {
  if (key) {
    localStorage.setItem(GEMINI_SETTINGS_KEY, key);
  } else {
    localStorage.removeItem(GEMINI_SETTINGS_KEY);
  }
};

// Model
const modelName = "gemini-2.5-flash";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Tag policy: keep it small and consistent
const CANONICAL_TAGS = [
  "charity",
  "donation",
  "tip",
  "assistance",
  "food",
  "groceries",
  "transport",
  "travel",
  "delivery",
  "courier",
  "loss",
  "subscription",
  "education",
  "skill",
  "work",
  "health",
  "utilities",
  "rent",
  "entertainment",
  "shopping",
] as const;

const BAD_GENERIC_TAGS = new Set(["people", "purchase", "misc", "other"]);

const hasRepeatCue = (raw: string): boolean =>
  /(\bsetiap\b|\btiap\b|\bper\s*(hari|minggu|bulan)\b|\bweekly\b|\bevery\b|\brutin\b|\bberkala\b|\blangganan\b)/i.test(
    raw,
  );

const normalizeTags = (
  tags: unknown,
  existingTags: string[] = [],
): string[] => {
  const arr = Array.isArray(tags) ? tags : [];

  // 1) sanitize
  let cleaned = arr
    .filter((t) => typeof t === "string")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .filter((t) => !BAD_GENERIC_TAGS.has(t));

  // 2) prefer canonical tags; allow a new tag only if it's concise
  const canonicalSet = new Set(CANONICAL_TAGS);
  cleaned = cleaned.map((t) => {
    // simple alias mapping
    if (t === "donasi") return "donation";
    if (t === "sedekah") return "charity";
    if (t === "makanan") return "food";
    if (t === "antar" || t === "pengiriman") return "delivery";
    if (t === "ojek" || t === "gojek" || t === "grab") return "transport";
    return t;
  });

  const canonicalFirst: string[] = [];
  const custom: string[] = [];

  for (const t of cleaned) {
    if (canonicalSet.has(t as any)) canonicalFirst.push(t);
    else if (/^[a-z0-9_]{2,18}$/.test(t)) custom.push(t); // keep it short
  }

  // 3) reuse existing tags if relevant (intersection-ish)
  const existingSet = new Set(existingTags.map((t) => t.toLowerCase()));
  const reused = canonicalFirst.filter((t) => existingSet.has(t));

  const merged = [...new Set([...reused, ...canonicalFirst, ...custom])];

  // max 3 tags
  return merged.slice(0, 3);
};

export const DEFAULT_PROMPT = `Task: Break down the input into distinct items. If the user lists multiple things, split them.

Classify each item into one of these categories:
1. TODO: Professional Work, Career, Productivity.
2. SHOPPING: Life Admin, Chores, Errands. IMPORTANT: If user says "Buy X for 50k", it is SHOPPING (Future/Plan), NOT FINANCE.
3. NOTE: Knowledge, ideas, thoughts.
4. EVENT: Specific dates/times.
5. FINANCE: ONLY for transactions that ALREADY happened (e.g. "Just bought coffee 20k", "Paid rent", "Received salary").
6. SKILL_LOG: User explicitly mentions spending time studying/practicing a skill.

GENERAL RULES:
- Output MUST be a JSON ARRAY.
- Extract amount as NUMBER (strip currency symbols and thousand separators).
- Extract targetDay from day names mentioned (Monday/Senin, Sunday/Minggu, etc).

DATE RESOLUTION (STRICT):
- Always resolve to meta.dateISO in YYYY-MM-DD.
- Always set meta.when when time is relative or weekday-based.
- Use Current Date context as reference.
- today/hari ini => when="today", dateISO = Current Date
- tomorrow/besok => when="tomorrow", dateISO = Current Date + 1 day
- If a weekday is mentioned => resolve to NEXT occurrence after Current Date; when="next_weekday"
- If a specific calendar date is mentioned => use it directly; when="specific_date"

SHOPPING RULES:
- shoppingCategory must be one of: urgent, routine, not_urgent.
- Set shoppingCategory="routine" ONLY IF repetition is explicitly indicated ("setiap", "tiap", "per minggu", "weekly", "every", "rutin", "berkala", "langganan") OR recurrenceDays is explicitly given.
- If a weekday/date is mentioned WITHOUT repetition words, it is NOT routine. Treat it as urgent (one-time scheduled purchase).
- If routine => fill recurrenceDays (if stated) AND targetDay (if stated).
- If urgent => fill targetDay (if stated).
- If unclear => not_urgent.

FINANCE RULES:
- financeType must be: expense, income, lending, reimbursement.
- paymentMethod must be EXACTLY as written by user (if missing, empty).
- budgetCategory must be: needs, wants, savings, sedekah.

BUDGET CATEGORY HINTS:
- needs: essentials (rent, groceries, electricity, transport, health)
- wants: non-essentials (dining out, hobbies, subscription entertainment)
- savings: investments, emergency fund, debt repayment
- sedekah: charity, giving, donation, tip that is clearly a donation

SKILL_LOG RULES:
- content MUST be a summary of what was learned (not the raw duration sentence).
- durationMinutes: convert hours to minutes.
- skillName: infer from context; if possible match to known skills provided.

TAGGING (STRICT):
- Generate at most 3 tags.
- Avoid generic tags like "people" and "purchase".
- Prefer intent-based tags first, then context, then objects.
- Use tags from this canonical list when possible:
  ${CANONICAL_TAGS.join(", ")}

Examples:
- "Gave money to street musician 5000" => tags ["charity","donation"], budgetCategory "sedekah"
- "tip driver gojek 10000" => tags ["tip","transport"]
- "Breakfast 14000" => tags ["food"]
- "beli susu besok hari senin 12000" => SHOPPING + shoppingCategory "urgent" + targetDay "Monday" + amount 12000
- "beli susu setiap senin 12000" => SHOPPING + shoppingCategory "routine" + targetDay "Monday" + amount 12000

Return ONLY the JSON array.`;

// classifyText(text, existingTags, availableSkills, retryCount, customPrompt)
export const classifyText = async (
  text: string,
  existingTags: string[] = [],
  availableSkills: string[] = [],
  retryCount = 0,
  customPrompt?: string,
): Promise<Partial<BrainDumpItem>[]> => {
  const apiKey = getGeminiKey();

  if (!apiKey) {
    console.warn("No Gemini API Key found.");
    return [
      {
        type: ItemType.NOTE,
        content: text,
        meta: { tags: ["missing-api-key"] },
      },
    ];
  }

  const ai = new GoogleGenAI({ apiKey });

  // Use local date context. If you want strict WIB handling, pass a fixed timezone string from your app.
  const now = new Date();
  const currentDateISO = now.toISOString();
  const currentDayName = now.toLocaleDateString("en-US", { weekday: "long" });

  const tagsContext =
    existingTags.length > 0
      ? `Existing tags you should try to reuse if relevant: ${existingTags.join(", ")}`
      : "";

  const skillsContext =
    availableSkills.length > 0
      ? `Known User Skills (match 'skillName' to one of these if possible): ${availableSkills.join(", ")}`
      : "";

  const promptToUse = customPrompt || DEFAULT_PROMPT;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Analyze this user input: "${text}".
Current Date context: ${currentDateISO} (${currentDayName}).
${tagsContext}
${skillsContext}

${promptToUse}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description:
                  "One of: TODO, SHOPPING, NOTE, EVENT, FINANCE, SKILL_LOG",
              },
              content: {
                type: Type.STRING,
                description: "Cleaned content text or summary",
              },
              meta: {
                type: Type.OBJECT,
                properties: {
                  // legacy
                  date: { type: Type.STRING },

                  // strict date
                  when: {
                    type: Type.STRING,
                    description:
                      "today, tomorrow, next_weekday, specific_date, or empty",
                  },
                  dateISO: {
                    type: Type.STRING,
                    description: "Resolved date in YYYY-MM-DD",
                  },

                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },

                  // shopping
                  shoppingCategory: {
                    type: Type.STRING,
                    description: "urgent, routine, not_urgent",
                  },
                  recurrenceDays: { type: Type.NUMBER },
                  targetDay: { type: Type.STRING },

                  // money
                  amount: { type: Type.NUMBER },
                  financeType: {
                    type: Type.STRING,
                    description: "expense, income, lending, reimbursement",
                  },
                  paymentMethod: { type: Type.STRING },
                  budgetCategory: {
                    type: Type.STRING,
                    description: "needs, wants, savings, sedekah",
                  },

                  // skill
                  durationMinutes: { type: Type.NUMBER },
                  skillName: { type: Type.STRING },
                },
              },
            },
            required: ["type", "content"],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    const resultsArray = Array.isArray(parsed) ? parsed : [parsed];

    return resultsArray.map((result: any) => {
      // 1) Validate type matches our Enum
      let matchedType = ItemType.NOTE;
      const typeStr = result.type?.toUpperCase();
      if (Object.values(ItemType).includes(typeStr as ItemType)) {
        matchedType = typeStr as ItemType;
      }

      // 2) Ensure meta exists
      if (!result.meta) result.meta = {};

      // 3) Default shopping category
      if (matchedType === ItemType.SHOPPING && !result.meta.shoppingCategory) {
        result.meta.shoppingCategory = "not_urgent";
      }

      // 4) Guardrail: routine requires repetition cue or explicit recurrenceDays
      if (matchedType === ItemType.SHOPPING) {
        const repeatCue = hasRepeatCue(text);
        const hasRec = typeof result.meta.recurrenceDays === "number";
        if (
          result.meta.shoppingCategory === "routine" &&
          !repeatCue &&
          !hasRec
        ) {
          result.meta.shoppingCategory = "urgent";
        }
      }

      // 5) Normalize tags with canonical preference
      result.meta.tags = normalizeTags(result.meta.tags, existingTags);

      // 6) If budgetCategory is sedekah, nudge tags (optional, but helps consistency)
      if (result.meta.budgetCategory === "sedekah") {
        const tset = new Set(result.meta.tags);
        if (!tset.has("charity") && !tset.has("donation")) {
          result.meta.tags = ["charity", ...result.meta.tags].slice(0, 3);
        }
      }

      return {
        type: matchedType,
        content: result.content || text,
        meta: result.meta,
      } as Partial<BrainDumpItem>;
    });
  } catch (error: any) {
    const status = error?.status || error?.response?.status;

    if (retryCount < 2 && (status === 429 || status >= 500)) {
      const delay = Math.pow(2, retryCount) * 1000;
      await wait(delay);
      return classifyText(
        text,
        existingTags,
        availableSkills,
        retryCount + 1,
        customPrompt,
      );
    }

    console.error("Gemini classification failed:", error);

    return [
      {
        type: ItemType.NOTE,
        content: text,
        meta: { tags: ["uncategorized"] },
      },
    ];
  }
};
