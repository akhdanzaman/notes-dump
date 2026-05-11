import { BrainDumpItem, BudgetRule, ParsedItemMetaV2, Wallet } from '../types';
import { inferBudgetCategoryId, resolveBudgetCategoryIdFromRules } from './budgetCategoryService';

type ParserItemKind = 'FINANCE' | 'SHOPPING' | 'TODO' | 'NOTE' | 'EVENT' | 'JOURNAL' | string | undefined;

interface EnrichFinanceMetaInput {
  rawText?: string;
  content?: string;
  itemType?: ParserItemKind;
  meta: ParsedItemMetaV2;
  availableWallets?: Pick<Wallet, 'id' | 'name'>[];
  availableBudgetRules?: Pick<BudgetRule, 'id' | 'name'>[];
  existingItems?: BrainDumpItem[];
}

type PatternSpec = {
  commodity: string;
  subcommodity: string;
  patterns: RegExp[];
  budgetHints?: string[];
};

const KNOWN_COMMODITIES = new Set([
  'food',
  'transport',
  'utilities',
  'health',
  'education',
  'shopping',
  'housing',
  'home',
  'hobby',
  'electronics',
  'clothing',
  'office_supplies',
  'donation',
  'bank_fee',
  'business',
  'debt',
  'loss',
  'saving',
  'investment',
  'income',
  'transfer',
  'personal_care',
  'digital',
  'social',
  'others',
]);

const KNOWN_SUBCOMMODITIES = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'drink',
  'groceries',
  'parking',
  'fuel',
  'public_transport',
  'ride_hailing',
  'toll',
  'electricity',
  'water',
  'internet',
  'phone',
  'doctor',
  'medicine',
  'insurance',
  'fitness',
  'course',
  'books',
  'tuition',
  'clothing',
  'electronics',
  'home',
  'hobby',
  'rent',
  'maintenance',
  'furniture',
  'haircut',
  'skincare',
  'spa',
  'subscription',
  'app',
  'game',
  'software',
  'gift',
  'donation',
  'party',
  'hangout',
  'miscellaneous',
  'tip',
  'meal',
  'water',
  'pet_food',
  'intercity_travel',
  'vehicle_maintenance',
  'cash_withdrawal',
  'ewallet_transfer',
  'cash_transfer',
  'bank_transfer',
  'wallet_transfer',
  'paylater_transfer',
  'paylater_payment',
  'balance_adjustment',
  'salary',
  'freelance',
  'refund',
  'cashback',
  'reimbursement',
  'thr_bonus',
  'goal_funding',
  'goal_completion',
  'stock',
  'rent',
  'laundry',
  'cleaning',
  'household_supplies',
  'home_appliance',
  'kitchen_appliance',
  'drinkware',
  'home_goods',
  'shoes',
  'shoe_care',
  'pants',
  'shirt',
  'tshirt',
  'socks',
  'apparel',
  'prayer_wear',
  'toothpaste',
  'grooming',
  'nail_care',
  'haircare',
  'fragrance',
  'toiletries',
  'vitamins',
  'health_drink',
  'ai_subscription',
  'cloud_hosting',
  '3d_modeling',
  'airbrush',
  'tools_materials',
  'batteries',
  'phone_accessory',
  'computer_accessory',
  'stationery',
  'pen',
  'charity',
  'birthday',
  'transfer_fee',
  'monthly_admin',
  'project_expense',
  'general_purchase',
  'lost_cash',
  'watch_repair',
]);

const EMPTY_FIELD_VALUES = new Set(['', '-', '—', 'n/a', 'na', 'none', 'null', 'unknown', 'tidak diketahui', 'other', 'others']);
const MERCHANT_STOP_WORDS = new Set([
  'cash', 'tunai', 'qris', 'gopay', 'go-pay', 'ovo', 'dana', 'shopeepay', 'bca', 'bni', 'bri', 'mandiri',
  'jago', 'blu', 'seabank', 'debit', 'kartu', 'card', 'bank', 'wallet', 'ewallet', 'e-wallet', 'pakai', 'via',
  'dari', 'from', 'untuk', 'buat', 'today', 'yesterday', 'tomorrow', 'hari', 'ini', 'kemarin', 'besok'
]);

const SIGNAL_PATTERNS: PatternSpec[] = [

  {
    commodity: 'home',
    subcommodity: 'furniture',
    patterns: [/\b(rak|meja|furniture|lemari)\b/i],
    budgetHints: ['needs', 'wants'],
  },
  {
    commodity: 'home',
    subcommodity: 'kitchen_appliance',
    patterns: [/\b(rice\s*cooker|ricecooker)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'home',
    subcommodity: 'home_appliance',
    patterns: [/\b(setrika|lampu\s+smart|stop\s+kontak)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'hobby',
    subcommodity: 'airbrush',
    patterns: [/\b(airbrush|penbrush)\b/i],
    budgetHints: ['wants'],
  },
  {
    commodity: 'hobby',
    subcommodity: 'tools_materials',
    patterns: [/\b(3d\s*print|mini\s+grinder|sculpting|call?iper|lem\s+korea|kawat)\b/i],
    budgetHints: ['wants'],
  },
  {
    commodity: 'hobby',
    subcommodity: 'sports',
    patterns: [/\b(badminton|futsal|basket|voli|tenis|renang|gym|fitnes|fitnes|olahraga|sport|bulutangkis)\b/i],
    budgetHints: ['wants'],
  },
  {
    commodity: 'social',
    subcommodity: 'membership',
    patterns: [/\b(iuran|dues|membership|langganan\s+klub|subscription\s+fee|anggota)\b/i],
    budgetHints: ['wants', 'fixed'],
  },
  {
    commodity: 'saving',
    subcommodity: 'goal_funding',
    patterns: [/\b(saving|savings|nabung|tabung|simpan|invest|investasi|dana\s+darurat|emergency\s+fund|goal|target|menabung|setor|deposit)\b/i],
    budgetHints: ['savings'],
  },
  {
    commodity: 'housing',
    subcommodity: 'rent',
    patterns: [/\b(bayar\s+kos(?:an)?|kosan)\b/i],
    budgetHints: ['fixed'],
  },
  {
    commodity: 'personal_care',
    subcommodity: 'laundry',
    patterns: [/\b(laundry)\b/i],
    budgetHints: ['needs', 'fixed'],
  },
  {
    commodity: 'clothing',
    subcommodity: 'apparel',
    patterns: [/\b(kemeja|celana|kaos|baju|sepatu|sarung|sajadah)\b/i],
    budgetHints: ['needs', 'wants'],
  },
  {
    commodity: 'digital',
    subcommodity: 'ai_subscription',
    patterns: [/\b(chatgpt|open\s*ai|openai|codex|grok)\b/i],
    budgetHints: ['wants'],
  },
  {
    commodity: 'food',
    subcommodity: 'breakfast',
    patterns: [/\b(sarapan|makan\s+pagi|breakfast|sahur)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'food',
    subcommodity: 'lunch',
    patterns: [/\b(makan\s+siang|lunch)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'food',
    subcommodity: 'dinner',
    patterns: [/\b(makan\s+malam|dinner)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'food',
    subcommodity: 'meal',
    patterns: [/\b(makan|meal|gofood|grabfood|shopee\s*food)\b/i],
    budgetHints: ['needs', 'wants'],
  },
  {
    commodity: 'food',
    subcommodity: 'drink',
    patterns: [/\b(kopi|coffee|es\s+teh|teh|boba|minum(?:an)?)\b/i],
    budgetHints: ['wants'],
  },
  {
    commodity: 'food',
    subcommodity: 'snack',
    patterns: [/\b(snack|cemilan|camilan|jajan)\b/i],
    budgetHints: ['wants'],
  },
  {
    commodity: 'food',
    subcommodity: 'groceries',
    patterns: [/\b(grocer(?:y|ies)|belanja\s+(?:bulanan|dapur|sayur)|sayur|sembako)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'transport',
    subcommodity: 'parking',
    patterns: [/\b(parkir|parking|parkiran)\b/i],
    budgetHints: ['fixed', 'needs'],
  },
  {
    commodity: 'transport',
    subcommodity: 'fuel',
    patterns: [/\b(bensin|fuel|pertalite|pertamax|solar|isi\s+bensin)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'transport',
    subcommodity: 'ride_hailing',
    patterns: [/\b(gojek|grab|maxim|ojol|ride\s*hailing|taxi|taksi|go.?car|grab.?car)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'transport',
    subcommodity: 'toll',
    patterns: [/\b(tol|toll)\b/i],
    budgetHints: ['fixed', 'needs'],
  },
  {
    commodity: 'utilities',
    subcommodity: 'electricity',
    patterns: [/\b(listrik|token\s+listrik|pln|electricity)\b/i],
    budgetHints: ['fixed', 'needs'],
  },
  {
    commodity: 'utilities',
    subcommodity: 'internet',
    patterns: [/\b(internet|wifi|wi-fi|indihome|biznet)\b/i],
    budgetHints: ['fixed', 'needs'],
  },
  {
    commodity: 'utilities',
    subcommodity: 'phone',
    patterns: [/\b(pulsa|paket\s+data|kuota|phone\s+credit)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'health',
    subcommodity: 'medicine',
    patterns: [/\b(obat|medicine|apotek|pharmacy)\b/i],
    budgetHints: ['needs'],
  },
  {
    commodity: 'social',
    subcommodity: 'donation',
    patterns: [/\b(sedekah|donasi|donation|amal|zakat)\b/i],
    budgetHints: ['sedekah'],
  },
  {
    commodity: 'digital',
    subcommodity: 'subscription',
    patterns: [/\b(langganan|subscription|netflix|spotify|youtube\s+premium)\b/i],
    budgetHints: ['wants', 'fixed'],
  },
];

function compact(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function normalizeToken(input?: string): string {
  return compact(input || '').toLowerCase();
}

function stripAmountAndNoise(input: string): string {
  return compact(input)
    .replace(/\b(?:rp\s*)?\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta|m|million)?\b/gi, ' ')
    .replace(/\b(?:pakai|via|dari|from|source|wallet|metode|method)\b.*$/i, ' ')
    .replace(/[,:;()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmptyField(value?: string): boolean {
  return !value || EMPTY_FIELD_VALUES.has(normalizeToken(value));
}

function cleanCanonicalValue(value: unknown, allowed: Set<string>, fallback?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeToken(value).replace(/\s+/g, '_');
  if (!normalized || EMPTY_FIELD_VALUES.has(normalized)) return fallback;
  return allowed.has(normalized) ? normalized : fallback;
}

function walletAliases(wallet: Pick<Wallet, 'id' | 'name'>): string[] {
  const raw = [wallet.id, wallet.name];
  const aliases = new Set<string>();
  raw.forEach(value => {
    const normalized = normalizeToken(value);
    if (!normalized) return;
    aliases.add(normalized);
    aliases.add(normalized.replace(/[\s_-]+wallet$/i, ''));
    aliases.add(normalized.replace(/[\s_-]+/g, ' '));
  });
  return Array.from(aliases).filter(Boolean);
}

function findWalletId(value: string | undefined, wallets: Pick<Wallet, 'id' | 'name'>[]): string | undefined {
  const normalized = normalizeToken(value);
  if (!normalized) return undefined;
  for (const wallet of wallets) {
    if (walletAliases(wallet).some(alias => alias === normalized)) return wallet.id;
  }
  return undefined;
}

function inferPaymentMethod(evidence: string, meta: ParsedItemMetaV2, wallets: Pick<Wallet, 'id' | 'name'>[]): string | undefined {
  if (meta.paymentMethod) return findWalletId(meta.paymentMethod, wallets) || meta.paymentMethod;
  const normalizedEvidence = ` ${normalizeToken(evidence)} `;
  for (const wallet of wallets) {
    const aliases = walletAliases(wallet).sort((a, b) => b.length - a.length);
    if (aliases.some(alias => alias.length >= 3 && normalizedEvidence.includes(` ${alias} `))) {
      return wallet.id;
    }
  }
  return undefined;
}

function inferCommoditySignal(evidence: string): PatternSpec | undefined {
  return SIGNAL_PATTERNS.find(spec => spec.patterns.some(pattern => pattern.test(evidence)));
}

function sanitizeMerchantCandidate(candidate: string): string | undefined {
  let cleaned = stripAmountAndNoise(candidate)
    .replace(/\b(?:pakai|via|cash|tunai|qris|debit|credit|kartu|card)\b.*$/i, '')
    .trim();

  if (!cleaned) return undefined;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const word of words) {
    const normalized = normalizeToken(word).replace(/[^a-z0-9-]/g, '');
    if (!normalized || MERCHANT_STOP_WORDS.has(normalized)) break;
    if (/^\d/.test(normalized)) break;
    kept.push(word);
    if (kept.length >= 5) break;
  }
  cleaned = kept.join(' ').replace(/[.,;:]+$/g, '').trim();

  if (!cleaned || cleaned.length < 2) return undefined;
  if (EMPTY_FIELD_VALUES.has(normalizeToken(cleaned))) return undefined;
  if (MERCHANT_STOP_WORDS.has(normalizeToken(cleaned))) return undefined;
  return cleaned;
}

function inferExplicitMerchant(evidence: string): string | undefined {
  const merchantPattern = /\b(?:di|at|from|merchant|toko|warung|resto|restoran|cafe|kafe|kedai)\s+([a-z0-9][a-z0-9&'.-]*(?:\s+[a-z0-9][a-z0-9&'.-]*){0,5})/i;
  const match = merchantPattern.exec(evidence);
  return match ? sanitizeMerchantCandidate(match[1]) : undefined;
}

function shouldEnrich(itemType: ParserItemKind, meta: ParsedItemMetaV2): boolean {
  if (itemType === 'FINANCE') return true;
  if (itemType === 'SHOPPING' && (meta.amount || meta.financeType || meta.paymentMethod)) return true;
  return false;
}

export function enrichFinanceMetaFromText({
  rawText = '',
  content = '',
  itemType,
  meta,
  availableWallets = [],
  availableBudgetRules = [],
  existingItems = [],
}: EnrichFinanceMetaInput): ParsedItemMetaV2 {
  const next: ParsedItemMetaV2 = { ...meta };
  const evidence = compact(`${rawText} ${content}`);

  const normalizedBudget = resolveBudgetCategoryIdFromRules(next.budgetCategory, availableBudgetRules);
  if (normalizedBudget) next.budgetCategory = normalizedBudget;
  else if (next.budgetCategory && isEmptyField(next.budgetCategory)) delete next.budgetCategory;

  if (typeof next.merchant === 'string' && isEmptyField(next.merchant)) delete next.merchant;
  const normalizedCommodity = cleanCanonicalValue(next.commodity, KNOWN_COMMODITIES);
  if (normalizedCommodity !== undefined) next.commodity = normalizedCommodity;
  else if (next.commodity) next.commodity = 'others';

  const normalizedSubcommodity = cleanCanonicalValue(next.subcommodity, KNOWN_SUBCOMMODITIES);
  if (normalizedSubcommodity !== undefined) next.subcommodity = normalizedSubcommodity;
  else if (next.subcommodity) delete next.subcommodity;

  if (!shouldEnrich(itemType, next)) return next;

  const paymentMethod = inferPaymentMethod(evidence, next, availableWallets);
  if (paymentMethod) next.paymentMethod = paymentMethod;

  const signal = inferCommoditySignal(evidence);
  if (signal) {
    if (!next.commodity || next.commodity === 'others') next.commodity = signal.commodity;
    if (!next.subcommodity) next.subcommodity = signal.subcommodity;
    if (!next.budgetCategory) {
      const budgetRuleId = inferBudgetCategoryId({
        text: evidence,
        meta: next,
        budgetRules: availableBudgetRules,
        existingItems,
        hints: signal.budgetHints,
      });
      if (budgetRuleId) next.budgetCategory = budgetRuleId;
    }
  }

  if (!next.budgetCategory) {
    const budgetRuleId = inferBudgetCategoryId({
      text: evidence,
      meta: next,
      budgetRules: availableBudgetRules,
      existingItems,
    });
    if (budgetRuleId) next.budgetCategory = budgetRuleId;
  }

  if (!next.merchant) {
    const merchant = inferExplicitMerchant(evidence);
    if (merchant) next.merchant = merchant;
  }

  return next;
}

export const PARSER_SIGNAL_GUIDANCE = `
Merchant / commodity extraction guardrails:
- merchant is a vendor/place only when the user explicitly names one ("di/at/from/toko/warung/resto/cafe/kedai <name>", or an obvious brand). Never copy payment method, wallet, amount words, or a generic meal/category into merchant. Leave merchant blank when unknown.
- commodity must use one of: food, transport, utilities, health, education, shopping, housing, personal_care, digital, social, others.
- subcommodity should be concrete when text supports it: sarapan/makan pagi/breakfast=>breakfast; makan siang=>lunch; makan malam=>dinner; parkir/parking=>parking; bensin=>fuel; gojek/grab/ojol=>ride_hailing; listrik/pln=>electricity; internet/wifi=>internet; sedekah/donasi=>donation.
- If the text only says an amount plus wallet (for example "12000 cash" or "keluar 50k bni"), keep merchant blank and use commodity/subcommodity only if the spending purpose is stated.
- paymentMethod/toWallet should match a known wallet ID when a wallet is explicitly mentioned (cash, gopay, bni, bca, etc.); otherwise leave blank.

Finance examples for raw signal quality:
- "sarapan 14000 cash" => FINANCE expense; paymentMethod cash wallet if known; commodity food; subcommodity breakfast; merchant blank.
- "parkir motor 3000 bni" => FINANCE expense; paymentMethod BNI wallet if known; commodity transport; subcommodity parking; merchant blank.
- "makan siang di Warung Bu Sari 18000 gopay" => FINANCE expense; merchant "Warung Bu Sari"; commodity food; subcommodity lunch; paymentMethod Gopay wallet if known.
- "bayar 12000 cash" => FINANCE expense; paymentMethod cash wallet if known; merchant blank; commodity/subcommodity others because purpose is unknown.
`;
