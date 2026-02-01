import { GoogleGenAI, Type } from "@google/genai";
import { ItemType, BrainDumpItem } from '../types';

const GEMINI_SETTINGS_KEY = 'braindump_gemini_key';

export const getGeminiKey = (): string => {
  return localStorage.getItem(GEMINI_SETTINGS_KEY) || process.env.API_KEY || '';
};

export const saveGeminiKey = (key: string) => {
  if (key) {
      localStorage.setItem(GEMINI_SETTINGS_KEY, key);
  } else {
      localStorage.removeItem(GEMINI_SETTINGS_KEY);
  }
};

// Updated to Gemini 2.5 Flash Lite as requested
const modelName = 'gemini-2.5-flash';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const DEFAULT_PROMPT = `Task: Break down the input into distinct items. If the user lists multiple things, split them.

Classify each item into one of these categories:
1. TODO: Professional Work, Career, Productivity.
2. SHOPPING: Life Admin, Chores, Errands.
3. NOTE: Knowledge, ideas, thoughts.
4. EVENT: Specific dates/times.
5. FINANCE: ONLY for recorded transactions (e.g. "Just bought coffee 20k").
6. SKILL_LOG: User explicitly mentions spending time studying, practicing, or working on a skill. (e.g., "Belajar react 30 menit", "Bedah regulasi 1 jam").

Instructions:
- Extract dates into ISO format if present.
- Generate relevant 'tags'.
- Extract 'amount' as a NUMBER for SHOPPING/FINANCE.
- Extract 'targetDay' for routine/shopping items.

For SKILL_LOG:
- **CRITICAL**: The 'content' MUST be the SUMMARY/KEY TAKEAWAYS of what was learned. If user says "Belajar React 1 jam tentang Hooks", content is "Belajar React tentang Hooks".
- Extract 'durationMinutes' as a number (convert hours to minutes).
- Extract 'skillName' based on the context (e.g. "React", "English", "Excel").

For FINANCE/SHOPPING:
- Extract 'paymentMethod' and 'budgetCategory' (needs/wants/savings).

DATE RESOLUTION (STRICT):
- "today/hari ini" => meta.when="today", meta.dateISO = Current Date (YYYY-MM-DD)
- "tomorrow/besok" => meta.when="tomorrow", meta.dateISO = Current Date + 1 day
- If a weekday is mentioned, resolve to NEXT occurrence.

Output a JSON ARRAY of objects.`;

// CHANGED: Added availableSkills to prompt context
export const classifyText = async (text: string, existingTags: string[] = [], availableSkills: string[] = [], retryCount = 0, customPrompt?: string): Promise<Partial<BrainDumpItem>[]> => {
  const apiKey = getGeminiKey();
  
  if (!apiKey) {
      console.warn("No Gemini API Key found.");
      return [{
        type: ItemType.NOTE,
        content: text,
        meta: { tags: ['missing-api-key'] }
      }];
  }

  const ai = new GoogleGenAI({ apiKey });

  const currentDate = new Date().toISOString();
  const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const tagsContext = existingTags.length > 0 ? `Existing tags context: ${existingTags.join(', ')}` : '';
  const skillsContext = availableSkills.length > 0 ? `Known User Skills (match 'skillName' to one of these if possible): ${availableSkills.join(', ')}` : '';

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
                description: "One of: TODO, SHOPPING, NOTE, EVENT, FINANCE, SKILL_LOG",
              },
              content: {
                type: Type.STRING,
                description: "The cleaned up content text or summary",
              },
              meta: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  quantity: { type: Type.STRING },
                  shoppingCategory: { type: Type.STRING },
                  recurrenceDays: { type: Type.NUMBER },
                  targetDay: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  financeType: { type: Type.STRING },
                  paymentMethod: { type: Type.STRING },
                  budgetCategory: { type: Type.STRING },
                  durationMinutes: { type: Type.NUMBER, description: "Duration in minutes for SKILL_LOG" },
                  skillName: { type: Type.STRING, description: "Name of the skill practiced" }
                }
              }
            },
            required: ["type", "content"],
          }
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
            result.meta.shoppingCategory = 'not_urgent';
        }

        return {
          type: matchedType,
          content: result.content || text,
          meta: result.meta || { tags: [] }
        };
    });

  } catch (error: any) {
    const status = error?.status || error?.response?.status;
    
    if (retryCount < 2 && (status === 429 || status >= 500)) {
        const delay = Math.pow(2, retryCount) * 1000;
        await wait(delay);
        return classifyText(text, existingTags, availableSkills, retryCount + 1, customPrompt);
    }

    console.error("Gemini classification failed:", error);
    
    return [{
      type: ItemType.NOTE,
      content: text,
      meta: { tags: ['uncategorized'] }
    }];
  }
};