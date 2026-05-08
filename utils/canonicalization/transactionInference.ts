import { BrainDumpItem, ItemType, ParsedItemMetaV2 } from '../../types';
import { CANONICAL_OTHER_VALUE, normalizeCanonicalFallback } from './defaults';

export interface TransactionCommodityInference {
  commodity: string;
  subcommodity: string;
  reason: string;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const norm = (value: unknown): string => text(value).toLowerCase().replace(/\s+/g, ' ');
const includesAny = (haystack: string, ...needles: string[]): boolean => needles.some(needle => haystack.includes(needle));
const hasToken = (haystack: string, token: string): boolean => new RegExp(`(^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(haystack);
const tagValues = (meta: ParsedItemMetaV2): string[] => (meta.tags || []).map(norm).filter(Boolean);
const hasTag = (tags: string[], ...needles: string[]): boolean => needles.some(needle => tags.includes(needle));

export const isTransactionLikeItem = (item: BrainDumpItem): boolean => {
  if (item.type === ItemType.FINANCE) return true;
  return item.type === ItemType.SHOPPING
    && item.status === 'done'
    && item.meta.shoppingCategory !== 'saving'
    && item.meta.shoppingCategory !== 'investment';
};

const isWeakOtherCanonical = (meta: ParsedItemMetaV2, field: 'commodity' | 'subcommodity'): boolean => {
  const canonical = meta.canonical?.[field];
  return normalizeCanonicalFallback(canonical?.value) === CANONICAL_OTHER_VALUE
    && !canonical?.needsReview
    && (!canonical?.confidence || canonical.confidence <= 0.3)
    && (!canonical?.rawValue || normalizeCanonicalFallback(canonical.rawValue) === CANONICAL_OTHER_VALUE);
};

const isMeaningful = (value?: string): boolean => {
  const normalized = normalizeCanonicalFallback(value);
  return Boolean(normalized && normalized !== CANONICAL_OTHER_VALUE);
};

const normalizeResolved = (value?: string): string => normalizeCanonicalFallback(value);

export const inferTransactionCommodity = (item: BrainDumpItem): TransactionCommodityInference => {
  const meta = item.meta || {};
  const content = norm(item.content);
  const tags = tagValues(meta);
  const tagText = tags.join(' ');
  const merchant = norm(meta.merchant);
  const financeType = norm(meta.financeType);
  const budgetCategory = norm(meta.budgetCategory);
  const paymentMethod = norm(meta.paymentMethod);
  const toWallet = norm(meta.toWallet);
  const all = [content, tagText, merchant, financeType, budgetCategory, paymentMethod, toWallet].join(' ');

  if (financeType === 'transfer') {
    if (includesAny(all, 'balance adjustment')) return { commodity: 'transfer', subcommodity: 'balance_adjustment', reason: 'transfer adjustment' };
    if (includesAny(all, 'atm', 'ambil uang')) return { commodity: 'transfer', subcommodity: 'cash_withdrawal', reason: 'cash withdrawal' };
    if (includesAny(all, 'gopaylater')) return { commodity: 'transfer', subcommodity: 'paylater_transfer', reason: 'paylater transfer' };
    if (includesAny(all, 'gopay', 'shopeepay', 'ovo', 'tapcash', 'ewallet')) return { commodity: 'transfer', subcommodity: 'ewallet_transfer', reason: 'ewallet transfer' };
    if (includesAny(all, 'cash')) return { commodity: 'transfer', subcommodity: 'cash_transfer', reason: 'cash transfer' };
    if (includesAny(all, 'bca', 'bni', 'jago', 'bank')) return { commodity: 'transfer', subcommodity: 'bank_transfer', reason: 'bank transfer' };
    return { commodity: 'transfer', subcommodity: 'wallet_transfer', reason: 'transfer' };
  }

  if (financeType === 'income') {
    if (includesAny(all, 'freelance')) return { commodity: 'income', subcommodity: 'freelance', reason: 'freelance income' };
    if (includesAny(all, 'tunjangan hari raya', 'thr')) return { commodity: 'income', subcommodity: 'thr_bonus', reason: 'THR income' };
    if (includesAny(all, 'gaji', 'salary', 'terima gaji', 'work')) return { commodity: 'income', subcommodity: 'salary', reason: 'salary income' };
    if (includesAny(all, 'refund')) return { commodity: 'income', subcommodity: 'refund', reason: 'refund income' };
    if (includesAny(all, 'cashback')) return { commodity: 'income', subcommodity: 'cashback', reason: 'cashback income' };
    if (includesAny(all, 'reimburse')) return { commodity: 'income', subcommodity: 'reimbursement', reason: 'reimbursement income' };
    return { commodity: 'income', subcommodity: 'other_income', reason: 'income' };
  }

  if (financeType === 'saving' || financeType === 'achieved_goal' || includesAny(content, 'saved for:', 'completed goal:', 'invested into:')) {
    if (includesAny(all, 'invested into', 'bbca', 'investment')) return { commodity: 'investment', subcommodity: 'stock', reason: 'investment funding' };
    return { commodity: 'saving', subcommodity: includesAny(content, 'completed goal:') ? 'goal_completion' : 'goal_funding', reason: 'saving goal' };
  }

  if (includesAny(all, 'reimburse')) return { commodity: 'business', subcommodity: 'reimbursement', reason: 'reimbursement' };
  if (includesAny(all, 'hilang', 'loss', 'undocumented')) return { commodity: 'loss', subcommodity: 'lost_cash', reason: 'loss' };
  if (includesAny(all, 'atm', 'ambil uang')) return { commodity: 'transfer', subcommodity: 'cash_withdrawal', reason: 'cash withdrawal' };
  if (includesAny([content, tagText, merchant].join(' '), 'gopay later', 'gopaylater', 'paylater')) return { commodity: 'debt', subcommodity: 'paylater_payment', reason: 'paylater payment' };
  if (includesAny(all, 'watch service')) return { commodity: 'accessories', subcommodity: 'watch_repair', reason: 'watch service' };
  if (hasToken(content, 'air') || includesAny(content, 'air mineral')) return { commodity: 'food', subcommodity: 'water', reason: 'water' };

  if (hasTag(tags, 'food') || includesAny(all, 'makan', 'lauk', 'ayam', 'burger', 'roti', 'mie ayam', 'nasi', 'takjil', 'cimol', 'mcflurry', 'gorengan', 'siomay', 'bakpia', 'saus', 'saos', 'kecap', 'tebus menu', 'drinking water', 'mineral water', 'iced tea')) {
    if (includesAny(all, 'water', 'air mineral', 'drinking water', 'mineral water')) return { commodity: 'food', subcommodity: 'water', reason: 'food water' };
    if (includesAny(all, 'iced tea', 'larutan')) return { commodity: 'food', subcommodity: 'drink', reason: 'food drink' };
    if (hasTag(tags, 'breakfast') || includesAny(all, 'sarapan')) return { commodity: 'food', subcommodity: 'breakfast', reason: 'breakfast' };
    if (hasTag(tags, 'lunch') || includesAny(all, 'siang', 'lunch')) return { commodity: 'food', subcommodity: 'lunch', reason: 'lunch' };
    if (hasTag(tags, 'dinner') || includesAny(all, 'malam', 'buka puasa', 'dinner')) return { commodity: 'food', subcommodity: 'dinner', reason: 'dinner' };
    if (hasTag(tags, 'snack', 'snacks') || includesAny(all, 'takjil', 'cimol', 'mcflurry', 'gorengan', 'bakpia', 'roti', 'siomay')) return { commodity: 'food', subcommodity: 'snack', reason: 'snack' };
    if (includesAny(all, 'saos', 'saus', 'kecap', 'groceries', 'makanan kucing')) return { commodity: 'food', subcommodity: includesAny(all, 'kucing') ? 'pet_food' : 'groceries', reason: 'groceries' };
    return { commodity: 'food', subcommodity: 'meal', reason: 'food meal' };
  }

  if (hasTag(tags, 'event') || includesAny(all, 'iims', 'birthday', 'treating', 'flowers')) {
    return { commodity: 'social', subcommodity: includesAny(all, 'birthday') ? 'birthday' : (includesAny(all, 'flowers') ? 'gift' : 'event'), reason: 'social event' };
  }

  if (hasTag(tags, 'transport', 'travel') || includesAny(all, 'handoyo', 'arus balik', 'perjalanan dinas', 'ojek', 'driver', 'ban motor', 'isi angin')) {
    if (includesAny(all, 'ojek')) return { commodity: 'transport', subcommodity: 'ride_hailing', reason: 'ride hailing' };
    if (includesAny(all, 'ban motor', 'isi angin')) return { commodity: 'transport', subcommodity: 'vehicle_maintenance', reason: 'vehicle maintenance' };
    if (includesAny(all, 'tip')) return { commodity: 'transport', subcommodity: 'tip', reason: 'driver tip' };
    if (includesAny(all, 'tiket', 'handoyo', 'arus balik')) return { commodity: 'transport', subcommodity: 'intercity_travel', reason: 'intercity travel' };
    return { commodity: 'transport', subcommodity: 'travel', reason: 'travel' };
  }

  if (includesAny(all, 'bayar kos', 'bayar kosan') || /^kos(an)?$/.test(content)) return { commodity: 'housing', subcommodity: 'rent', reason: 'rent' };
  if (hasTag(tags, 'laundry') || includesAny(all, 'laundry')) return { commodity: 'personal_care', subcommodity: 'laundry', reason: 'laundry' };

  if (hasTag(tags, 'clothing') || includesAny(all, 'kemeja', 'celana', 'kaos', 'baju', 'sarung', 'sajadah', 'sepatu', 'shoe', 'coat', 'jahit', 'permak jeans', 'kaos kaki', 'jam tangan', 'kalung')) {
    if (includesAny(all, 'sepatu', 'shoe')) return { commodity: 'clothing', subcommodity: includesAny(all, 'cleaning') ? 'shoe_care' : 'shoes', reason: 'shoes' };
    if (includesAny(all, 'kaos kaki')) return { commodity: 'clothing', subcommodity: 'socks', reason: 'socks' };
    if (includesAny(all, 'celana', 'jeans', 'pants', 'short')) return { commodity: 'clothing', subcommodity: 'pants', reason: 'pants' };
    if (includesAny(all, 'kaos', 'tshirt', 't-shirt')) return { commodity: 'clothing', subcommodity: 'tshirt', reason: 'tshirt' };
    if (includesAny(all, 'kemeja', 'shirt')) return { commodity: 'clothing', subcommodity: 'shirt', reason: 'shirt' };
    if (includesAny(all, 'jahit', 'permak', 'repair')) return { commodity: 'clothing', subcommodity: 'repair', reason: 'clothing repair' };
    if (includesAny(all, 'jam tangan', 'kalung', 'accessories', 'accesories')) return { commodity: 'clothing', subcommodity: 'accessories', reason: 'accessories' };
    if (includesAny(all, 'sarung', 'sajadah')) return { commodity: 'clothing', subcommodity: 'prayer_wear', reason: 'prayer wear' };
    return { commodity: 'clothing', subcommodity: 'apparel', reason: 'apparel' };
  }

  if (includesAny(all, 'tisu', 'kantong sampah', 'set alat pembersih', 'kamar mandi', 'home', 'gantungan baju', 'stop kontak', 'rak ', 'lampu smart', 'meja', 'ricecooker', 'rice cooker', 'setrika', 'blanket', 'payung', 'tumbler', 'tumblr')) {
    if (includesAny(all, 'tumbler', 'tumblr')) return { commodity: 'home', subcommodity: 'drinkware', reason: 'drinkware' };
    if (includesAny(all, 'ricecooker', 'rice cooker')) return { commodity: 'home', subcommodity: 'kitchen_appliance', reason: 'kitchen appliance' };
    if (includesAny(all, 'setrika', 'lampu smart', 'stop kontak')) return { commodity: 'home', subcommodity: 'home_appliance', reason: 'home appliance' };
    if (includesAny(all, 'rak', 'meja')) return { commodity: 'home', subcommodity: 'furniture', reason: 'furniture' };
    if (includesAny(all, 'set alat pembersih', 'kamar mandi', 'kantong sampah')) return { commodity: 'home', subcommodity: 'cleaning', reason: 'cleaning supplies' };
    if (includesAny(all, 'tisu')) return { commodity: 'home', subcommodity: 'household_supplies', reason: 'household supplies' };
    return { commodity: 'home', subcommodity: 'home_goods', reason: 'home goods' };
  }

  if (hasTag(tags, 'skincare', 'haircare') || includesAny(all, 'skincare', 'haircare', 'shampo', 'shampoo', 'shaver', 'cukur', 'cukuran', 'potong rambut', 'cotton bud', 'sabun', 'pasta gigi', 'parfum', 'gunting kuku')) {
    if (includesAny(all, 'pasta gigi')) return { commodity: 'personal_care', subcommodity: 'toothpaste', reason: 'toothpaste' };
    if (includesAny(all, 'shaver', 'cukur', 'cukuran')) return { commodity: 'personal_care', subcommodity: 'grooming', reason: 'grooming' };
    if (includesAny(all, 'gunting kuku')) return { commodity: 'personal_care', subcommodity: 'nail_care', reason: 'nail care' };
    if (includesAny(all, 'haircare', 'shampo', 'shampoo', 'potong rambut', 'hairdryer')) return { commodity: 'personal_care', subcommodity: 'haircare', reason: 'haircare' };
    if (includesAny(all, 'parfum')) return { commodity: 'personal_care', subcommodity: 'fragrance', reason: 'fragrance' };
    if (includesAny(all, 'skincare')) return { commodity: 'personal_care', subcommodity: 'skincare', reason: 'skincare' };
    return { commodity: 'personal_care', subcommodity: 'toiletries', reason: 'toiletries' };
  }

  if (hasTag(tags, 'health') || includesAny(all, 'vitamin', 'medicine', 'larutan penyegar')) {
    if (includesAny(all, 'vitamin')) return { commodity: 'health', subcommodity: 'vitamins', reason: 'vitamins' };
    if (includesAny(all, 'larutan')) return { commodity: 'health', subcommodity: 'health_drink', reason: 'health drink' };
    return { commodity: 'health', subcommodity: 'medicine', reason: 'medicine' };
  }

  if (includesAny(all, 'chatgpt', 'open ai', 'openai', 'codex', 'grok', 'vps', 'n8n', 'auth')) {
    if (includesAny(all, 'vps')) return { commodity: 'digital', subcommodity: 'cloud_hosting', reason: 'cloud hosting' };
    if (includesAny(all, 'chatgpt', 'open ai', 'openai', 'codex', 'grok')) return { commodity: 'digital', subcommodity: 'ai_subscription', reason: 'AI subscription' };
    return { commodity: 'digital', subcommodity: 'software', reason: 'software' };
  }

  if (hasTag(tags, 'education') || includesAny(all, 'buku ', 'book ', 'the mom test', 'art of listening')) return { commodity: 'education', subcommodity: 'books', reason: 'books' };

  if (includesAny(all, '3d print', '3d modeling', 'airbrush', 'mini grinder', 'sculpting', 'calliper', 'caliper', 'lem korea', 'kawat', 'penbrush')) {
    if (includesAny(all, '3d modeling')) return { commodity: 'hobby', subcommodity: '3d_modeling', reason: '3D modeling' };
    if (includesAny(all, 'airbrush', 'penbrush')) return { commodity: 'hobby', subcommodity: 'airbrush', reason: 'airbrush' };
    return { commodity: 'hobby', subcommodity: 'tools_materials', reason: 'hobby tools/materials' };
  }

  if (hasTag(tags, 'electronics') || includesAny(all, 'headset', 'mouse', 'baterai', 'case hp', 'case s22', 'hairdryer')) {
    if (includesAny(all, 'baterai')) return { commodity: 'electronics', subcommodity: 'batteries', reason: 'batteries' };
    if (includesAny(all, 'case')) return { commodity: 'electronics', subcommodity: 'phone_accessory', reason: 'phone accessory' };
    if (includesAny(all, 'headset', 'mouse')) return { commodity: 'electronics', subcommodity: 'computer_accessory', reason: 'computer accessory' };
    return { commodity: 'electronics', subcommodity: 'device', reason: 'electronics' };
  }

  if (hasTag(tags, 'stationary', 'office') || includesAny(all, 'pulpen', 'gunting', 'stationary')) return { commodity: 'office_supplies', subcommodity: includesAny(all, 'pulpen') ? 'pen' : 'stationery', reason: 'office supplies' };
  if (hasTag(tags, 'donation', 'charity') || includesAny(all, 'donated', 'santunan', 'anak yatim', 'bagi bagi thr', 'ngasih', 'donation')) return { commodity: 'donation', subcommodity: 'charity', reason: 'donation' };
  if (includesAny(all, 'biaya admin', 'admin transfer')) return { commodity: 'bank_fee', subcommodity: includesAny(all, 'transfer') ? 'transfer_fee' : 'monthly_admin', reason: 'bank fee' };
  if (hasTag(tags, 'business') || includesAny(all, 'business', 'project')) return { commodity: 'business', subcommodity: 'project_expense', reason: 'business expense' };
  if (hasTag(tags, 'purchase')) return { commodity: 'shopping', subcommodity: 'general_purchase', reason: 'general purchase' };

  return { commodity: CANONICAL_OTHER_VALUE, subcommodity: CANONICAL_OTHER_VALUE, reason: 'fallback' };
};

export const getCommodityForItemAnalytics = (item: BrainDumpItem): string => {
  const meta = item.meta || {};
  const canonical = normalizeResolved(meta.canonical?.commodity?.needsReview ? undefined : meta.canonical?.commodity?.value);
  const raw = normalizeResolved(meta.commodity);
  const inferred = inferTransactionCommodity(item).commodity;

  if (isMeaningful(canonical) && !isWeakOtherCanonical(meta, 'commodity')) return canonical;
  if (isMeaningful(raw)) return raw;
  if (isMeaningful(inferred)) return inferred;
  return CANONICAL_OTHER_VALUE;
};

export const getSubcommodityForItemAnalytics = (item: BrainDumpItem): string => {
  const meta = item.meta || {};
  const canonical = normalizeResolved(meta.canonical?.subcommodity?.needsReview ? undefined : meta.canonical?.subcommodity?.value);
  const raw = normalizeResolved(meta.subcommodity);
  const inferred = inferTransactionCommodity(item).subcommodity;

  if (isMeaningful(canonical) && !isWeakOtherCanonical(meta, 'subcommodity')) return canonical;
  if (isMeaningful(raw)) return raw;
  if (isMeaningful(inferred)) return inferred;
  return CANONICAL_OTHER_VALUE;
};
