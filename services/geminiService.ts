import { Type } from "@google/genai";
import { ItemType, BrainDumpItem } from '../types';

import { getLocalISOString } from '../utils/selectors/dateUtils';
import { createGeminiClient, getGeminiKey, parseJsonResponse, withAiRetry, DEFAULT_FLASH_MODEL } from './aiService';
import { enrichFinanceMetaFromText, PARSER_SIGNAL_GUIDANCE } from './parserSignalService';

export { getGeminiKey, saveGeminiKey, DEFAULT_FLASH_MODEL } from './aiService';

export const DEFAULT_PROMPT = `Task: Split input into distinct items. Output MUST be a JSON ARRAY of objects.

TYPE (pick one):
- TODO: work/career/productivity actions.
- SHOPPING: planned purchases/errands (future/plan) OR any upcoming/unpaid financial transactions. IMPORTANT: “Buy X 50k” => SHOPPING, not FINANCE. "Saving for X 100m" => SHOPPING with shoppingCategory "saving". If a transaction is not yet done/paid, it MUST be SHOPPING with shoppingCategory "not_urgent".
- NOTE: ideas/knowledge/random thoughts.
- EVENT: scheduled dates/times.
- FINANCE: ONLY transactions that ALREADY happened (paid/bought/received) OR money movement OR adding funds to a saving goal. ALL FINANCE entries are considered DONE.
- JOURNAL: personal diary entries, feelings, daily recaps, "Dear Diary", or explicit "Log to journal".

COMMON EXTRACTION:
- amount: NUMBER only (strip currency symbols + thousand separators).
- targetDay: day name if mentioned (Senin/Monday, Minggu/Sunday, etc).
- tags: max 2, see TAG RULES below.

DATE (STRICT):
- ALWAYS output \`meta.date\` as a full ISO 8601 string including the local timezone offset (e.g., "YYYY-MM-DDTHH:mm:ss.sss±hh:mm").
- Calculate the exact date and time based on the "Current Date context" provided. If the user specifies a relative day (e.g., "yesterday", "tomorrow"), calculate that exact date and return it with the current local time and timezone offset.
- Do NOT output just "YYYY-MM-DD". Always include the time and timezone to prevent timezone shifting bugs.
- FOR JOURNAL: Default date to the exact current local time if not specified. "Journal for yesterday..." => date=yesterday at current time.

SHOPPING META:
- shoppingCategory ∈ {urgent, routine, not_urgent, saving}
- routine ONLY if repetition is explicit: "setiap|tiap|per minggu|weekly|every|rutin|berkala|langganan" OR recurrenceDays given.
- saving ONLY if the user is setting a goal to save money for something (e.g., "saving for a car 100 million").
- If weekday/date mentioned WITHOUT repetition words => NOT routine, set urgent (one-time scheduled).
- routine => include recurrenceDays (if stated) + targetDay (if stated).
- urgent => include targetDay (if stated).
- default => not_urgent.

PRIORITY (TODO/EVENT ONLY):
- priority ∈ {low, normal, high}
- high: urgent, important, deadline today, "penting", "segera", "urgent", "prioritas".
- low: "kapan-kapan", "nanti saja", "low priority", "tidak mendesak".
- default: normal.

DEEP WORK TODO (OPTIONAL):
- If a TODO is abstract/multi-step (summary/research/plan/design/build/implement/audit/write/prepare), include meta.subtasks with 3-5 concrete action steps.
- Do not add subtasks for concrete errands, payments, simple calls/messages, or already checklist-like input.

MONEY META (FINANCE + money-related SHOPPING):
- financeType ∈ {expense, income, transfer, saving}
- budgetCategory ∈ {needs, wants, savings, sedekah, fixed, unintend}
  - needs: groceries/electricity/health
  - wants: dining/hobby/entertainment/subscription entertainment
  - savings: investment/emergency/debt repayment
  - sedekah: charity/giving/donation
  - fixed: rent/laundry/internet/electricity/parking
  - unintend: miss/extra charge/penalty/lost
- commodity ∈ {food, transport, utilities, health, education, shopping, housing, personal_care, digital, social, other}
- subcommodity: detailed sub-category.
  - food: breakfast, lunch, dinner, snack, drink, groceries
  - transport: parking, fuel, public_transport, ride_hailing, toll
  - utilities: electricity, water, internet, phone
  - health: doctor, medicine, insurance, fitness
  - education: course, books, tuition
  - shopping: clothing, electronics, home, hobby
  - housing: rent, maintenance, furniture
  - personal_care: haircut, skincare, spa
  - digital: subscription, app, game, software
  - social: gift, donation, party, hangout
  - other: miscellaneous
- paymentMethod: EXACT text from user (Source Wallet), else "".
- toWallet: Destination wallet (transfer only).
- merchant: Vendor name if mentioned.
- amount: number.

CLASSIFICATION PRIORITY (FINANCE):
1. Determine financeType.
2. Determine budgetCategory.
3. Determine commodity.
4. Determine subcommodity.
If ambiguous, choose the most conservative value. If commodity/subcommodity unclear, use 'other'.

FINANCE META:
- transfer: moving money between own accounts (withdraw, deposit, topup, pindah buku).
    - IF transfer: set 'paymentMethod' = Source Wallet, 'toWallet' = Destination Wallet.
- saving: adding funds to an existing saving goal (e.g., "saved 500k for car from BCA").
    - IF saving: set 'paymentMethod' = Source Wallet, 'financeType' = 'saving'.
- IMPORTANT: You MUST ALWAYS set 'budgetCategory' for 'expense' and 'saving' transactions.
  - For 'saving', choose the category based on the goal (e.g. saving for emergency fund -> 'savings', saving for a new car -> 'wants').

TAG RULES (STRICT):
- Max 2 tags.
- Do NOT duplicate values from budgetCategory, commodity, subcommodity, or paymentMethod.
- Use for specific context not covered above (e.g. "trip to bali", "birthday").

${PARSER_SIGNAL_GUIDANCE}
Examples:
- "Gave money to street musician 5000" => financeType "expense", budgetCategory "sedekah", commodity "social", subcommodity "donation", amount 5000
- "tip driver gojek 10000" => financeType "expense", budgetCategory "wants", commodity "transport", subcommodity "tip", amount 10000
- "Breakfast 14000" => financeType "expense", budgetCategory "needs", commodity "food", subcommodity "breakfast", amount 14000
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

export const classifyText = async (
  text: string,
  existingTags: string[] = [],
  availableSkills: string[] = [],
  retryCount = 0,
  customPrompt?: string,
  parsingModel?: string,
  availableWallets: {id: string, name: string}[] = [],
  availableBudgetRules: {id: string, name: string}[] = []
): Promise<Partial<BrainDumpItem>[]> => {
  const apiKey = getGeminiKey();
  const ai = createGeminiClient(apiKey);

  if (!ai || !apiKey) {
    console.warn("No Gemini API Key found.");
    return [{
      type: ItemType.NOTE,
      content: text,
      meta: { tags: ['missing-api-key'] }
    }];
  }

  const now = new Date();
  const currentDate = getLocalISOString(now);
  const currentDayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const tagsContext = existingTags.length > 0 ? `Existing tags context: ${existingTags.join(', ')}` : '';
  const skillsContext = availableSkills.length > 0 ? `Known User Skills (match 'skillName' to one of these if possible): ${availableSkills.join(', ')}` : '';
  const walletsContext = availableWallets.length > 0 ? `Known Wallets (for paymentMethod/toWallet): ${availableWallets.map(w => `${w.name} [ID: ${w.id}]`).join(', ')}` : '';
  const budgetContext = availableBudgetRules.length > 0 ? `Known Budget Categories (for budgetCategory): ${availableBudgetRules.map(b => `${b.name} [ID: ${b.id}]`).join(', ')}` : '';

  const promptToUse = customPrompt || DEFAULT_PROMPT;
  const activeModel = parsingModel || DEFAULT_FLASH_MODEL;

  try {
    const response = await withAiRetry(() => ai.models.generateContent({
      model: activeModel,
      contents: `Analyze this user input: "${text}". 
      Current Date context: ${currentDate} (${currentDayName}).
      ${tagsContext}
      ${skillsContext}
      ${walletsContext}
      ${budgetContext}
      
      ***CRITICAL FOR BUDGET CATEGORIES***: For 'budgetCategory', do NOT lazily default to "finance" or a generic term. Intelligently deduce the most appropriate category based on context (e.g., 'makan', 'kopi', 'gofood' -> Food; 'bensin', 'grab' -> Transportation) AND then strictly output ONLY the exact matched ID from Known Budget Categories.
      ***CRITICAL FOR MULTIPLICITY***: Return EXACTLY ONE object in the array for a single logical transaction/input. Do NOT split an expense into multiple array elements. A single sentence MUST result in exactly 1 array item.
      ***CRITICAL FOR WALLETS***: For paymentMethod and toWallet, use ONLY the exact ID.

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
                description: "One of: TODO, SHOPPING, NOTE, EVENT, FINANCE, JOURNAL",
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
                  budgetCategory: { type: Type.STRING, description: "Classification of expense budget category"  },
                  commodity: { type: Type.STRING, description: "Main expenditure category" },
                  subcommodity: { type: Type.STRING, description: "Detailed sub-category" },
                  merchant: { type: Type.STRING, description: "Merchant/Vendor name" },
                  priority: { type: Type.STRING, description: "Priority level: low, normal, high" },
                  subtasks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Optional nested todo steps for abstract deep-work TODOs" }
                }
              }
            },
            required: ["type", "content"],
          }
        },
      },
    }));

    const parsed = parseJsonResponse<any[]>(response.text, []);
    const resultsArray = Array.isArray(parsed) ? parsed : [parsed];

    return resultsArray.map((result: any) => {
      let matchedType = ItemType.NOTE;
      const typeStr = result?.type?.toUpperCase();
      if (Object.values(ItemType).includes(typeStr as ItemType)) {
        matchedType = typeStr as ItemType;
      }

      if (matchedType === ItemType.SHOPPING && !result?.meta?.shoppingCategory) {
        if (!result.meta) result.meta = {};
        result.meta.shoppingCategory = 'not_urgent';
      }

      if (matchedType === ItemType.JOURNAL && !result?.meta?.date) {
        if (!result.meta) result.meta = {};
        result.meta.date = new Date().toISOString();
      }

      const content = result?.content || text;
      const meta = enrichFinanceMetaFromText({
        rawText: text,
        content,
        itemType: matchedType,
        meta: result?.meta || { tags: [] },
        availableWallets,
        availableBudgetRules,
      });

      return {
        type: matchedType,
        content,
        meta
      };
    });

  } catch (error: any) {
    if (retryCount < 2) {
      return classifyText(text, existingTags, availableSkills, retryCount + 1, customPrompt, parsingModel, availableWallets, availableBudgetRules);
    }

    console.error("Gemini classification failed:", error);

    return [{
      type: ItemType.NOTE,
      content: text,
      meta: {
        tags: ['parsing_failed'],
        parsingError: error?.message || "Unknown error occurred during parsing"
      }
    }];
  }
};
