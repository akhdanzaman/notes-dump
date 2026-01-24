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

// CHANGED: Return type is now a Promise of an Array
export const classifyText = async (
  text: string,
  existingTags: string[] = [],
  retryCount = 0,
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

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Analyze this user input: "${text}". 
      Current Date context: ${currentDate} (${currentDayName}).
      ${tagsContext}
      
      Task: Break down the input into distinct items. If the user lists multiple things, split them.

      Classify each item into one of these categories:
      1. TODO: Professional Work, Career, Productivity.
      2. SHOPPING: Life Admin, Chores, Errands, Bills. **IMPORTANT**: If user says "Buy X for 50k", it is SHOPPING (Future/Plan), NOT Finance yet.
      3. NOTE: Knowledge, ideas, thoughts.
      4. EVENT: Specific dates/times.
      5. FINANCE: ONLY for recorded transactions that ALREADY happened (e.g. "Just bought coffee 20k", "Paid rent", "Received salary").

      Instructions:

      - Extract dates into ISO format if present.
      - Generate relevant 'tags'.
      - Extract 'amount' as a NUMBER (remove currency symbols) for SHOPPING (Estimated Cost) or FINANCE (Actual Amount).
      - Extract specific day names mentioned (e.g. "Senin", "Monday", "Minggu") into 'targetDay'.
      
      For SHOPPING:
      - 'shoppingCategory': 'urgent', 'routine', 'not_urgent'.
      - If 'routine' (e.g., "Laundry every 3 days on Monday"), extract 'recurrenceDays' AND 'targetDay'.
      - If 'urgent' (e.g., "Buy headset on Sunday"), extract 'targetDay'.
      
      For FINANCE:
      - Determine 'financeType': 'expense', 'income', 'lending', 'reimbursement'.
      - Extract 'paymentMethod'.
      DATE RESOLUTION (STRICT):
      - You MUST normalize relative time words to an ISO date in meta.dateISO (YYYY-MM-DD).
      - Use Current Date context as the reference.
      - "today/hari ini" => meta.when="today", meta.dateISO = Current Date (YYYY-MM-DD)
      - "tomorrow/besok" => meta.when="tomorrow", meta.dateISO = Current Date + 1 day
      - If a weekday is mentioned (Senin/Monday, Minggu/Sunday, etc), resolve it to the NEXT occurrence of that weekday after Current Date:
        meta.when="specific_date", meta.dateISO="YYYY-MM-DD", meta.targetDay="Monday" etc
      - If a specific calendar date is mentioned, use it:
        meta.when="specific_date", meta.dateISO="YYYY-MM-DD"
      - If no time reference exists:
        meta.when="none" and do NOT invent a dateISO

      Output a JSON ARRAY of objects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "One of: TODO, SHOPPING, NOTE, EVENT, FINANCE",
              },
              content: {
                type: Type.STRING,
                description: "The cleaned up content text",
              },
              meta: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  quantity: { type: Type.STRING },
                  shoppingCategory: { type: Type.STRING },
                  recurrenceDays: { type: Type.NUMBER },
                  targetDay: {
                    type: Type.STRING,
                    description: "Specific day name e.g. Monday, Sunday",
                  },
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
                    description: "cash, paylater, etc",
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

    // Ensure result is an array
    const resultsArray = Array.isArray(parsed) ? parsed : [parsed];

    return resultsArray.map((result: any) => {
      // Validate type matches our Enum
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

      return {
        type: matchedType,
        content: result.content || text,
        meta: result.meta || { tags: [] },
      };
    });
  } catch (error: any) {
    const status = error?.status || error?.response?.status;
    const msg = error?.message || "";

    if (retryCount < 2 && (status === 429 || status >= 500)) {
      const delay = Math.pow(2, retryCount) * 1000;
      await wait(delay);
      return classifyText(text, existingTags, retryCount + 1);
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
