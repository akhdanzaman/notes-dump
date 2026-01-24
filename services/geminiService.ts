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
const modelName = "gemini-flash-lite-latest";

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
  const tagsContext =
    existingTags.length > 0
      ? `Existing tags you should try to reuse if relevant: ${existingTags.join(", ")}`
      : "";

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Analyze this user input: "${text}". 
      Current Date context: ${currentDate}.
      ${tagsContext}
      
      Task: Break down the input into distinct items. If the user lists multiple things (e.g., "Buy milk, call mom, and fix the door"), split them into separate objects.

      Classify into one of these categories:
      1. TODO: strictly for Professional Work, Career, and Productivity tasks.
      2. SHOPPING: for ALL Life Admin, Chores, Errands, and Purchases (e.g., "Laundry", "Fill gas", "Fix door", "Buy milk").
      3. NOTE: Knowledge, ideas, thoughts.
      4. EVENT: Things with specific dates/times.

      Instructions:
      - Extract dates into ISO format if present.
      - ALWAYS generate relevant 'tags' for ALL categories (TODO, SHOPPING, NOTE, EVENT).
      - Check against existing tags list provided and reuse them if they fit semantically.
      
      For SHOPPING (Life Admin) items:
      - determine 'shoppingCategory': 'urgent' (needs immediate action), 'routine' (repeating chores like laundry/groceries), or 'not_urgent' (someday/wishlist).
      - If 'routine' or implies repetition, try to guess 'recurrenceDays' (e.g. weekly = 7, monthly = 30) as a number. Default to 7 if unclear but routine.
      - TIME-BOUND: If the user mentions a specific day or deadline (e.g., "tomorrow", "by Friday", "on Oct 12"), STRICTLY extract this to 'meta.date'.
      - extract 'quantity' if applicable.


      Output a JSON ARRAY of objects.`,
      config: {
        responseMimeType: "application/json",
        // CHANGED: Schema is now an ARRAY of objects
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "One of: TODO, SHOPPING, NOTE, EVENT",
              },
              content: {
                type: Type.STRING,
                description:
                  "The cleaned up content text for this specific item",
              },
              meta: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "ISO date string" },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  quantity: { type: Type.STRING },
                  shoppingCategory: {
                    type: Type.STRING,
                    description: "urgent, not_urgent, or routine",
                  },
                  recurrenceDays: {
                    type: Type.NUMBER,
                    description: "Number of days for routine items",
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
        content: result.content || text, // Fallback to original text if content missing (rare in split scenario)
        meta: result.meta || { tags: [] },
      };
    });
  } catch (error: any) {
    // Error Handling
    const status = error?.status || error?.response?.status;
    const msg = error?.message || "";
    const code = error?.code;

    const isQuota =
      msg.includes("RESOURCE_EXHAUSTED") ||
      (status === 429 && msg.includes("quota")) ||
      code === 429;

    if (isQuota) {
      console.warn("Gemini Quota Exceeded. Falling back to basic Note.");
      return [
        {
          type: ItemType.NOTE,
          content: text,
          meta: { tags: ["quota-limit"] },
        },
      ];
    }

    if (retryCount < 2 && (status === 429 || status >= 500)) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.warn(`Gemini API Error (${status}), retrying in ${delay}ms...`);
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
