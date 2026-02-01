import { GoogleGenAI, Type } from "@google/genai";
import { ItemType, BrainDumpItem } from "../types";
//a
const GEMINI_SETTINGS_KEY = "braindump_gemini_key";
const GEMINI_LAST_RATE_LIMIT_KEY = "gemini_last_rate_limit_ts";
const GEMINI_LAST_ERROR_CODE_KEY = "gemini_last_error_code";

export const getGeminiKey = (): string => {
  return localStorage.getItem(GEMINI_SETTINGS_KEY) || process.env.API_KEY || "";
};

export const saveGeminiKey = (key: string) => {
  if (key) localStorage.setItem(GEMINI_SETTINGS_KEY, key);
  else localStorage.removeItem(GEMINI_SETTINGS_KEY);
};

// Model
const modelName = "gemini-2.5-flash";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Compact but strict prompt
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
- Set shoppingCategory="routine" ONLY IF the text explicitly indicates repetition (e.g. "setiap", "tiap", "per minggu", "weekly", "every", "rutin", "berkala", "langganan", or recurrenceDays is explicitly mentioned).
- If a weekday/date is mentioned without repetition words, it is NOT routine. Treat it as "urgent" (scheduled one-time purchase).
- Default: if it's a one-time planned purchase with a specific day/date, use "urgent".

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

Generate tags with the following priority:
1. Intent-based tags (WHY the action happened)
2. Context-based tags (WHAT situation/domain)
3. Object-based tags (WHO/WHAT involved)

Rules:
- Avoid generic tags like "people", "purchase", unless no better tag exists.
- Prefer semantic tags such as: charity, donation, tip, assistance, food, transport, loss, delivery, subscription, education.
- Maximum 3 tags per item.

Examples:
- "Gave money to street musician" → tags: ["charity", "donation"]
- "tip driver gojek" → tags: ["tip", "transport"]
- "Breakfast" → tags: ["food"]
- "Kirim dompet" (sending wallet back to owner) → tags: ["assistance", "delivery"]
- "Beli sepatu" → tags: ["shopping"]

Output a JSON ARRAY of objects.`;

type ApiErrorCode =
  | "rate_limit"
  | "quota_exceeded"
  | "invalid_api_key"
  | "permission_denied"
  | "server_error"
  | "invalid_response"
  | "network_error"
  | "unknown_error"
  | "cooldown_active";

type ApiErrorInfo = {
  code: ApiErrorCode;
  status?: number;
  message?: string;
  retryable: boolean;
};

const getErrorStatus = (err: any): number | undefined => {
  return (
    err?.status ??
    err?.response?.status ??
    err?.cause?.status ??
    err?.error?.status
  );
};

const getErrorMessage = (err: any): string => {
  const msg =
    err?.message || err?.response?.data?.message || err?.error?.message;
  return typeof msg === "string" ? msg : "";
};

const classifyApiError = (err: any): ApiErrorInfo => {
  const status = getErrorStatus(err);
  const messageRaw = getErrorMessage(err);
  const message = messageRaw.toLowerCase();

  // auth
  if (status === 401)
    return {
      code: "invalid_api_key",
      status,
      message: messageRaw,
      retryable: false,
    };
  if (status === 403)
    return {
      code: "permission_denied",
      status,
      message: messageRaw,
      retryable: false,
    };

  // rate limit / quota
  if (status === 429)
    return { code: "rate_limit", status, message: messageRaw, retryable: true };
  if (
    message.includes("quota") ||
    message.includes("exceeded") ||
    message.includes("insufficient")
  ) {
    return {
      code: "quota_exceeded",
      status,
      message: messageRaw,
      retryable: true,
    };
  }

  // server
  if (typeof status === "number" && status >= 500) {
    return {
      code: "server_error",
      status,
      message: messageRaw,
      retryable: true,
    };
  }

  // response parsing
  if (message.includes("json") || message.includes("parse")) {
    return {
      code: "invalid_response",
      status,
      message: messageRaw,
      retryable: true,
    };
  }

  // network-ish
  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout")
  ) {
    return {
      code: "network_error",
      status,
      message: messageRaw,
      retryable: true,
    };
  }

  return {
    code: "unknown_error",
    status,
    message: messageRaw,
    retryable: false,
  };
};

const setLastError = (code: ApiErrorCode) => {
  localStorage.setItem(GEMINI_LAST_ERROR_CODE_KEY, code);
};

const setLastRateLimitNow = () => {
  localStorage.setItem(GEMINI_LAST_RATE_LIMIT_KEY, Date.now().toString());
};

const getLastRateLimitTs = (): number => {
  const v = Number(localStorage.getItem(GEMINI_LAST_RATE_LIMIT_KEY) || 0);
  return Number.isFinite(v) ? v : 0;
};

// NOTE: BrainDumpItem.meta probably doesn't have error fields typed.
// We intentionally return extra meta fields; update your types if you want strict TS.
const errorFallbackItem = (
  text: string,
  info: ApiErrorInfo,
): Partial<BrainDumpItem> => {
  return {
    type: ItemType.NOTE,
    content: text,
    meta: {
      tags: ["ai_error"],
      error: {
        code: info.code,
        status: info.status ?? null,
        retryable: info.retryable,
        message: info.message || "",
        at: new Date().toISOString(),
      },
    } as any,
  };
};

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
        meta: {
          tags: ["missing-api-key"],
          error: { code: "invalid_api_key" },
        } as any,
      },
    ];
  }

  // Cooldown heuristic: if we recently hit 429/quota, avoid hammering the API.
  const lastLimitTs = getLastRateLimitTs();
  const nowTs = Date.now();
  const COOLDOWN_MS = 60_000; // 1 minute
  if (lastLimitTs > 0 && nowTs - lastLimitTs < COOLDOWN_MS) {
    const info: ApiErrorInfo = {
      code: "cooldown_active",
      retryable: true,
      message: "Recent rate-limit/quota hit; cooldown active.",
    };
    setLastError(info.code);
    return [errorFallbackItem(text, info)];
  }

  const ai = new GoogleGenAI({ apiKey });

  const currentDate = new Date().toISOString();
  const currentDayName = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  const tagsContext =
    existingTags.length > 0
      ? `Existing tags context: ${existingTags.join(", ")}`
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
                  // dates
                  dateISO: { type: Type.STRING },
                  when: { type: Type.STRING },
                  targetDay: { type: Type.STRING },

                  // tags
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },

                  // shopping
                  shoppingCategory: { type: Type.STRING },
                  recurrenceDays: { type: Type.NUMBER },

                  // money
                  amount: { type: Type.NUMBER },
                  financeType: { type: Type.STRING },
                  paymentMethod: { type: Type.STRING },
                  budgetCategory: { type: Type.STRING },

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

    // Reset last error markers on success
    setLastError("unknown_error");

    const parsed = JSON.parse(response.text || "[]");
    const resultsArray = Array.isArray(parsed) ? parsed : [parsed];

    return resultsArray.map((result: any) => {
      // Validate type matches our Enum
      let matchedType = ItemType.NOTE;
      const typeStr = result.type?.toUpperCase();
      if (Object.values(ItemType).includes(typeStr as ItemType)) {
        matchedType = typeStr as ItemType;
      }

      if (!result.meta) result.meta = {};
      if (!Array.isArray(result.meta.tags)) result.meta.tags = [];

      // Default shopping category if missing
      if (matchedType === ItemType.SHOPPING && !result.meta.shoppingCategory) {
        result.meta.shoppingCategory = "not_urgent";
      }

      return {
        type: matchedType,
        content: result.content || text,
        meta: result.meta,
      } as Partial<BrainDumpItem>;
    });
  } catch (error: any) {
    const info = classifyApiError(error);

    // Record last error code
    setLastError(info.code);

    // If rate limited / quota, set cooldown marker
    if (info.code === "rate_limit" || info.code === "quota_exceeded") {
      setLastRateLimitNow();
    }

    // Retry on retryable errors
    if (info.retryable && retryCount < 2) {
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

    // Return explicit AI error item (NOT just uncategorized)
    return [errorFallbackItem(text, info)];
  }
};
