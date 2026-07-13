import { Type } from '@google/genai';
import { BudgetRule, TransactionLineItem, Wallet } from '../types';
import { resolveBudgetCategoryIdFromRules } from './budgetCategoryService';
import {
  createGeminiClient,
  DEFAULT_FLASH_MODEL,
  getGeminiKey,
  parseJsonResponse,
  withAiRetry,
} from './aiService';
import { sanitizeTransactionLineItems, sumTransactionLineItems } from '../utils/transactionLineItems';

export interface ReceiptParseResult {
  merchant?: string;
  date?: string;
  walletId?: string;
  currency?: string;
  totalAmount: number;
  lineItems: TransactionLineItem[];
  warnings: string[];
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const normalizeWalletId = (value: unknown, wallets: Wallet[]): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const normalized = value.trim().toLowerCase();
  const wallet = wallets.find((candidate) =>
    candidate.id.toLowerCase() === normalized || candidate.name.trim().toLowerCase() === normalized,
  );
  return wallet?.id;
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  const direct = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
  if (direct) return direct;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

export const parseReceiptImage = async (
  file: File,
  context: string,
  wallets: Wallet[],
  budgetRules: BudgetRule[],
  model = DEFAULT_FLASH_MODEL,
): Promise<ReceiptParseResult> => {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 10 MB.');

  const apiKey = getGeminiKey();
  const ai = createGeminiClient(apiKey);
  if (!apiKey || !ai) throw new Error('Gemini API key belum dikonfigurasi.');

  const base64 = arrayBufferToBase64(await file.arrayBuffer());
  const walletContext = wallets.length
    ? wallets.map((wallet) => `${wallet.name} [ID: ${wallet.id}]`).join(', ')
    : 'Tidak ada wallet yang dikonfigurasi.';
  const budgetContext = budgetRules.length
    ? budgetRules.map((rule) => `${rule.name} [ID: ${rule.id}]`).join(', ')
    : 'Tidak ada kategori budget yang dikonfigurasi.';
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prompt = `Baca gambar nota/invoice ini dan ekstrak SATU transaksi induk dengan line items.

Konteks tambahan pengguna (lebih dipercaya daripada teks gambar bila konflik):
${context.trim() || '(tidak ada)'}

Tanggal lokal hari ini: ${localDate}
Wallet tersedia: ${walletContext}
Kategori budget tersedia: ${budgetContext}

Aturan wajib:
- Jangan pecah satu nota menjadi beberapa transaksi. Kembalikan satu objek dengan array lineItems.
- Setiap line item HARUS punya amount sebagai total baris setelah quantity.
- Tentukan budgetCategory PER LINE ITEM. Gunakan hanya ID kategori yang tersedia. Item dalam nota yang sama boleh memiliki kategori berbeda.
- Gunakan walletId hanya dari ID wallet yang tersedia. Jika konteks menyebut wallet, prioritaskan itu.
- date harus YYYY-MM-DD. Jika konteks memberi tanggal, prioritaskan konteks.
- Sertakan pajak, service charge, biaya admin, pembulatan, atau diskon sebagai line item tersendiri agar jumlah lineItems sedekat mungkin dengan totalAmount. Diskon boleh bernilai negatif.
- Jangan mengarang item yang tidak terlihat. Bila teks tidak jelas, beri nama yang konservatif.
- commodity dan subcommodity berupa label ringkas berbahasa Inggris untuk analitik.
- totalAmount adalah grand total yang benar-benar dibayar.
`;

  const response = await withAiRetry(() => ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: file.type, data: base64 } },
      ],
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          merchant: { type: Type.STRING },
          date: { type: Type.STRING },
          walletId: { type: Type.STRING },
          currency: { type: Type.STRING },
          totalAmount: { type: Type.NUMBER },
          lineItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.STRING },
                unitPrice: { type: Type.NUMBER },
                amount: { type: Type.NUMBER },
                budgetCategory: { type: Type.STRING },
                commodity: { type: Type.STRING },
                subcommodity: { type: Type.STRING },
                kind: { type: Type.STRING },
              },
              required: ['name', 'amount'],
            },
          },
        },
        required: ['totalAmount', 'lineItems'],
      },
    },
  }));

  const raw = parseJsonResponse<any>(response.text, {});
  const mapped = Array.isArray(raw?.lineItems)
    ? raw.lineItems.map((line: any, index: number) => ({
        ...line,
        id: `receipt-line-${Date.now()}-${index + 1}`,
        budgetCategory: resolveBudgetCategoryIdFromRules(line?.budgetCategory, budgetRules),
      }))
    : [];
  let lineItems = sanitizeTransactionLineItems(mapped);
  const warnings: string[] = [];
  const statedTotal = typeof raw?.totalAmount === 'number' && Number.isFinite(raw.totalAmount)
    ? raw.totalAmount
    : sumTransactionLineItems(lineItems);
  const lineTotal = sumTransactionLineItems(lineItems);
  const difference = Math.round((statedTotal - lineTotal) * 100) / 100;

  if (Math.abs(difference) >= 0.01) {
    lineItems = sanitizeTransactionLineItems([
      ...lineItems,
      {
        id: `receipt-adjustment-${Date.now()}`,
        name: difference > 0 ? 'Biaya / penyesuaian nota' : 'Diskon / penyesuaian nota',
        amount: difference,
        budgetCategory: undefined,
        commodity: difference > 0 ? 'fees' : 'discount',
        subcommodity: 'receipt_adjustment',
        kind: difference > 0 ? 'adjustment' : 'discount',
      },
    ]);
    warnings.push('Selisih grand total dimasukkan sebagai line item penyesuaian.');
  }

  if (!lineItems.length) throw new Error('Tidak ada line item yang dapat dibaca dari gambar.');
  if (lineItems.some((line) => !line.budgetCategory) && budgetRules.length) {
    warnings.push('Beberapa line item belum memiliki kategori budget dan perlu ditinjau.');
  }

  return {
    merchant: typeof raw?.merchant === 'string' ? raw.merchant.trim() || undefined : undefined,
    date: normalizeDate(raw?.date),
    walletId: normalizeWalletId(raw?.walletId, wallets),
    currency: typeof raw?.currency === 'string' ? raw.currency.trim() || 'IDR' : 'IDR',
    totalAmount: sumTransactionLineItems(lineItems),
    lineItems,
    warnings,
  };
};
