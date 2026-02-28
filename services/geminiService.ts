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

export const DEFAULT_PROMPT = `Task: Split input into distinct items. Output MUST be a JSON ARRAY of objects.

TYPE (pick one):
- TODO: work/career/productivity actions.
- SHOPPING: planned purchases/errands (future/plan). IMPORTANT: “Buy X 50k” => SHOPPING, not FINANCE. "Saving for X 100m" => SHOPPING with shoppingCategory "saving".
- NOTE: ideas/knowledge/random thoughts.
- EVENT: scheduled dates/times.
- FINANCE: ONLY transactions that ALREADY happened (paid/bought/received) OR money movement OR adding funds to a saving goal.
- SKILL_LOG: time spent learning/practicing a skill.
- JOURNAL: personal diary entries, feelings, daily recaps, "Dear Diary", or explicit "Log to journal".

COMMON EXTRACTION:
- amount: NUMBER only (strip currency symbols + thousand separators).
- targetDay: day name if mentioned (Senin/Monday, Minggu/Sunday, etc).
- tags: max 3, see TAG RULES below.

DATE (STRICT):
- Always resolve meta.dateISO = YYYY-MM-DD when any time reference exists.
- Set meta.when if relative/weekday-based:
  - today/hari ini => when="today"
  - tomorrow/besok => when="tomorrow"
  - yesterday/kemarin => when="yesterday" (Important for FINANCE/JOURNAL)
  - weekday mentioned => NEXT occurrence after current date, when="next_weekday"
  - explicit calendar date => when="specific_date"
- FOR JOURNAL: Default date to TODAY if not specified. "Journal for yesterday..." => date=yesterday.

SHOPPING META:
- shoppingCategory ∈ {urgent, routine, not_urgent, saving}
- routine ONLY if repetition is explicit: "setiap|tiap|per minggu|weekly|every|rutin|berkala|langganan" OR recurrenceDays given.
- saving ONLY if the user is setting a goal to save money for something (e.g., "saving for a car 100 million").
- If weekday/date mentioned WITHOUT repetition words => NOT routine, set urgent (one-time scheduled).
- routine => include recurrenceDays (if stated) + targetDay (if stated).
- urgent => include targetDay (if stated).
- default => not_urgent.

MONEY META (FINANCE + money-related SHOPPING):
- paymentMethod: EXACT text from user (Source Wallet), else "".
- budgetCategory ∈ {needs, wants, savings, sedekah}
  - needs: rent/groceries/electricity/transport/health
  - wants: dining/hobby/entertainment/subscription entertainment
  - savings: investment/emergency/debt repayment
  - sedekah: charity/giving/donation

FINANCE META:
- financeType ∈ {expense, income, transfer, saving}
- transfer: moving money between own accounts (withdraw, deposit, topup, pindah buku).
    - IF transfer: set 'paymentMethod' = Source Wallet, 'toWallet' = Destination Wallet.
- saving: adding funds to an existing saving goal (e.g., "saved 500k for car from BCA").
    - IF saving: set 'paymentMethod' = Source Wallet, 'financeType' = 'saving'.

SKILL_LOG META:
- content MUST be summary/key takeaways (not raw duration sentence)
  Example: "Belajar React 1 jam tentang Hooks" => content "Belajar React tentang Hooks"
- durationMinutes: NUMBER (convert hours→minutes)
- skillName: infer from context; match known skills if provided

TAG RULES (STRICT):
- Priority: intent > context > object.
- Avoid generic tags: "people", "purchase" unless no better option.
- Prefer semantic tags like: charity, donation, tip, assistance, food, transport, loss, delivery, subscription, education.
- Max 3 tags.

Examples:
- "Gave money to street musician 5000" => tags ["charity","donation"], budgetCategory "sedekah"
- "tip driver gojek 10000" => tags ["tip","transport"]
- "Breakfast 14000" => tags ["food"]
- "Kirim dompet" => tags ["assistance","delivery"]
- "beli susu besok hari senin 12000" => SHOPPING urgent + targetDay Monday + amount 12000
- "beli susu setiap senin 12000" => SHOPPING routine + targetDay Monday + amount 12000
- "Tarik tunai BCA 500rb" => FINANCE transfer, paymentMethod "BCA", toWallet "Cash", amount 500000
- "Topup Gopay dari Mandiri 100k" => FINANCE transfer, paymentMethod "Mandiri", toWallet "Gopay", amount 100000
- "I felt really productive today because I finished the project" => JOURNAL, date=TODAY
- "Journal kemarin: pergi ke pantai sama keluarga" => JOURNAL, content="Pergi ke pantai sama keluarga", date=YESTERDAY
- "Saving for a new car 100 million" => SHOPPING saving, content "new car", amount 100000000
- "Saved 500k for car from BCA" => FINANCE saving, content "Saved for car", amount 500000, paymentMethod "BCA"
`;

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
                description: "One of: TODO, SHOPPING, NOTE, EVENT, FINANCE, SKILL_LOG, JOURNAL",
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
                  paymentMethod: { type: Type.STRING, description: "Source Wallet / Method" },
                  toWallet: { type: Type.STRING, description: "Destination Wallet for transfers" },
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

        // Default date for JOURNAL if missing is TODAY (created_at handles it mostly, but strict date helps sorting)
        if (matchedType === ItemType.JOURNAL && !result.meta?.date) {
             if (!result.meta) result.meta = {};
             result.meta.date = new Date().toISOString();
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