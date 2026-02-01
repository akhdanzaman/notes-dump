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

// Updated to Gemini 2.5 Flash Lite as requested
const modelName = "gemini-2.5-flash";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const DEFAULT_PROMPT = `Task: Break down the input into distinct items. If the user lists multiple things, split them.

Classify each item into one of these categories:
1. TODO: Professional Work, Career, Productivity.
2. SHOPPING: Life Admin, Chores, Errands. **IMPORTANT**: If user says "Buy X for 50k", it is SHOPPING (Future/Plan), NOT FINANCE yet.
3. NOTE: Knowledge, ideas, thoughts.
4. EVENT: Specific dates/times.
5. FINANCE: ONLY for recorded transactions that ALREADY happened (e.g. "Just bought coffee 20k", "Paid rent", "Received salary").
6. SKILL_LOG: User explicitly mentions spending time studying, practicing, or working on a skill (e.g., "Belajar react 30 menit", "Bedah regulasi 1 jam").

Instructions (GENERAL):
- Extract dates into ISO format if present.
- Generate relevant 'tags'.
- Extract 'amount' as a NUMBER (remove currency symbols, dots/commas as thousand separators) for SHOPPING (Estimated Cost) or FINANCE (Actual Amount).
- Extract specific day names mentioned (e.g. "Senin", "Monday", "Minggu") into 'targetDay'.

For SHOPPING:
- 'shoppingCategory': 'urgent', 'routine', 'not_urgent'.
- If 'routine' (e.g., "Laundry every 3 days on Monday"), extract 'recurrenceDays' AND 'targetDay'.
- If 'urgent' (e.g., "Buy headset on Sunday"), extract 'targetDay'.
- If category not clear, default to 'not_urgent'.

For FINANCE and SHOPPING (if it involves money):
- Extract 'paymentMethod' EXACTLY as described (e.g., "QRIS BNI", "Cash", "Gopay Later", "CC BCA"). If not specified, leave empty.
- Determine 'budgetCategory' based on the 50-30-20 rule:
  - 'needs': Essentials (Rent, Groceries, Electricity, Transport, Health).
  - 'wants': Non-essentials (Dining out, Movies, Hobbies, Subscription services).
  - 'savings': Investments, Emergency fund, Debt repayment.
  - 'sedekah': giving, voluntary charity, or benevolent acts.

For FINANCE:
- Determine 'financeType': 'expense', 'income', 'lending', 'reimbursement'.

For SKILL_LOG:
- **CRITICAL**: The 'content' MUST be the SUMMARY/KEY TAKEAWAYS of what was learned (not the raw duration sentence).
  - If user says "Belajar React 1 jam tentang Hooks", content is "Belajar React tentang Hooks".
- Extract 'durationMinutes' as a NUMBER (convert hours to minutes).
- Extract 'skillName' based on the context (e.g. "React", "English", "Excel").
- If possible, match skillName to one of the known user skills provided in context.

DATE RESOLUTION (STRICT):
- You MUST normalize relative time words to an ISO date in meta.dateISO (YYYY-MM-DD).
- Always set meta.when when time is relative or weekday-based.
- Use Current Date context as the reference.
- "today/hari ini" => meta.when="today", meta.dateISO = Current Date (YYYY-MM-DD)
- "tomorrow/besok" => meta.when="tomorrow", meta.dateISO = Current Date + 1 day
- If a weekday is mentioned (Senin/Monday, Minggu/Sunday, etc), resolve it to the NEXT occurrence of that weekday after Current Date; set meta.when="next_weekday".
- If a specific calendar date is mentioned, use it directly in meta.dateISO; set meta.when="specific_date".

Output a JSON ARRAY of objects.`;

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

  const currentDate = new Date().toISOString();
  const currentDayName = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

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
Current Date context: ${currentDate} (${currentDayName}).
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
                description: "The cleaned up content text or summary",
              },
              meta: {
                type: Type.OBJECT,
                properties: {
                  // Keep legacy 'date' if you still use it somewhere:
                  date: { type: Type.STRING },

                  // Restored and enforced ISO date fields:
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
                  quantity: { type: Type.STRING },

                  // Shopping fields (restored strictness)
                  shoppingCategory: {
                    type: Type.STRING,
                    description: "urgent, routine, not_urgent",
                  },
                  recurrenceDays: { type: Type.NUMBER },
                  targetDay: {
                    type: Type.STRING,
                    description: "Specific day name e.g. Monday, Sunday",
                  },

                  // Money fields (restored strictness)
                  amount: {
                    type: Type.NUMBER,
                    description: "Numeric amount (cost/price/value)",
                  },
                  financeType: {
                    type: Type.STRING,
                    description: "expense, income, lending, reimbursement",
                  },
                  paymentMethod: {
                    type: Type.STRING,
                    description:
                      "Detailed payment source e.g. QRIS BNI, GOPAY LATER",
                  },
                  budgetCategory: {
                    type: Type.STRING,
                    description: "needs, wants, savings, sedekah",
                  },

                  // Skill log fields
                  durationMinutes: {
                    type: Type.NUMBER,
                    description: "Duration in minutes for SKILL_LOG",
                  },
                  skillName: {
                    type: Type.STRING,
                    description: "Name of the skill practiced",
                  },
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
      let matchedType = ItemType.NOTE;
      const typeStr = result.type?.toUpperCase();

      if (Object.values(ItemType).includes(typeStr as ItemType)) {
        matchedType = typeStr as ItemType;
      }

      // Default shopping category if missing
      if (matchedType === ItemType.SHOPPING && !result.meta?.shoppingCategory) {
        if (!result.meta) result.meta = {};
        result.meta.shoppingCategory = "not_urgent";
      }

      // Defensive: ensure tags array exists
      if (!result.meta) result.meta = {};
      if (!Array.isArray(result.meta.tags)) result.meta.tags = [];

      return {
        type: matchedType,
        content: result.content || text,
        meta: result.meta,
      };
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
