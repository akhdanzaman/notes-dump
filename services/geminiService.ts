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

export const DEFAULT_PROMPT = `Task: Split the input into distinct items. If the user lists multiple things, split them.
Output MUST be a JSON ARRAY of objects.

TYPE (pick one):
1) TODO: work/career/productivity actions.
2) SHOPPING: planned purchases / life admin / chores / errands (future/plan).
   IMPORTANT: “Buy X 50k” => SHOPPING (plan), NOT FINANCE.
3) NOTE: ideas/knowledge/thoughts.
4) EVENT: scheduled dates/times.
5) FINANCE: ONLY transactions that ALREADY happened (paid/bought/received) OR money movement (transfer/topup/withdraw).
6) SKILL_LOG: user explicitly mentions time spent learning/practicing a skill.

COMMON EXTRACTION (apply to all items):
- content: clean, concise item text (for SKILL_LOG: summary/key takeaways, see SKILL_LOG rules).
- tags: generate max 3 tags (see TAG RULES).
- amount: NUMBER only when money is present (strip currency symbols + thousand separators like dots/commas).
- targetDay: day name if mentioned (Senin/Monday, Minggu/Sunday, etc).

DATE RESOLUTION (STRICT):
- If ANY time reference exists (today/tomorrow/weekday/date/time), you MUST set meta.dateISO in YYYY-MM-DD.
- Always set meta.when when time is relative/weekday-based:
  - today/hari ini => meta.when="today", meta.dateISO = current date
  - tomorrow/besok => meta.when="tomorrow", meta.dateISO = current date + 1 day
  - weekday mentioned (Senin/Monday, etc) => resolve to the NEXT occurrence after current date, meta.when="next_weekday"
  - explicit calendar date => meta.when="specific_date", meta.dateISO = that date (YYYY-MM-DD)

SHOPPING RULES:
- meta.shoppingCategory ∈ {"urgent","routine","not_urgent"}
- Set shoppingCategory="routine" ONLY IF repetition is explicit:
  repetition keywords: "setiap|tiap|per minggu|weekly|every|rutin|berkala|langganan"
  OR recurrenceDays is explicitly mentioned.
- If weekday/date is mentioned WITHOUT repetition words => NOT routine.
  Treat it as one-time scheduled purchase: shoppingCategory="urgent" and include targetDay/dateISO as applicable.
- routine => include recurrenceDays (if stated) + targetDay (if stated).
- urgent => include targetDay (if stated).
- default => not_urgent.

MONEY META (FINANCE + money-related SHOPPING):
- meta.paymentMethod: EXACT text from user as Source Wallet/Method (e.g., "QRIS BNI", "Cash", "Gopay Later", "CC BCA", "BCA"). If not specified, "".
- meta.budgetCategory ∈ {"needs","wants","savings","sedekah"}
  - needs: rent/groceries/electricity/transport/health
  - wants: dining/hobby/entertainment/subscription entertainment
  - savings: investment/emergency/debt repayment
  - sedekah: charity/giving/donation/tips/helping others

FINANCE RULES:
- meta.financeType ∈ {"expense","income","lending","reimbursement","transfer"}
  - expense: money spent
  - income: money received (salary, refund received, etc)
  - lending: money given as loan
  - reimbursement: paid by you but will be repaid / reimbursed
  - transfer: moving money between your own accounts/wallets (withdraw, deposit, topup, pindah buku, tarik tunai)
- IF financeType="transfer":
  - meta.paymentMethod = Source Wallet (EXACT text)
  - meta.toWallet = Destination Wallet (e.g. "Cash", "Gopay", "OVO", "BCA", etc)
  - amount must be extracted as NUMBER

SKILL_LOG RULES:
- CRITICAL: content MUST be summary/key takeaways (not the raw duration sentence)
  Example: "Belajar React 1 jam tentang Hooks" => content "Belajar React tentang Hooks"
- meta.durationMinutes: NUMBER (convert hours → minutes)
- meta.skillName: infer from context; if a list of known skills is provided, match to one of them when possible.

TAG RULES (STRICT):
- Priority: intent > context > object.
- Avoid generic tags like "people", "purchase" unless no better option exists.
- Prefer semantic tags like: charity, donation, tip, assistance, food, transport, loss, delivery, subscription, education.
- Max 3 tags per item.

Examples:
- "Gave money to street musician 5000" => FINANCE expense, tags ["charity","donation"], budgetCategory "sedekah", amount 5000
- "tip driver gojek 10000" => FINANCE expense, tags ["tip","transport"], amount 10000
- "Breakfast 14000" => FINANCE expense, tags ["food"], amount 14000
- "Kirim dompet" => TODO or NOTE depending on phrasing, tags ["assistance","delivery"]
- "beli susu besok hari senin 12000" => SHOPPING urgent + targetDay Monday + amount 12000 + dateISO for next Monday
- "beli susu setiap senin 12000" => SHOPPING routine + targetDay Monday + amount 12000 (+ recurrenceDays if stated)
- "Tarik tunai BCA 500rb" => FINANCE transfer, paymentMethod "BCA", toWallet "Cash", amount 500000
- "Topup Gopay dari Mandiri 100k" => FINANCE transfer, paymentMethod "Mandiri", toWallet "Gopay", amount 100000

OUTPUT FORMAT:
Return ONLY a JSON ARRAY of objects.
Each object must have:
- type: one of TODO | SHOPPING | NOTE | EVENT | FINANCE | SKILL_LOG
- content: string
- meta: object (optional fields as needed: dateISO, when, tags, quantity, shoppingCategory, recurrenceDays, targetDay, amount, financeType, paymentMethod, toWallet, budgetCategory, durationMinutes, skillName)
`;

// CHANGED: Added availableSkills to prompt context
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
                  date: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  quantity: { type: Type.STRING },
                  shoppingCategory: { type: Type.STRING },
                  recurrenceDays: { type: Type.NUMBER },
                  targetDay: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  financeType: { type: Type.STRING },
                  paymentMethod: {
                    type: Type.STRING,
                    description: "Source Wallet / Method",
                  },
                  toWallet: {
                    type: Type.STRING,
                    description: "Destination Wallet for transfers",
                  },
                  budgetCategory: { type: Type.STRING },
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
