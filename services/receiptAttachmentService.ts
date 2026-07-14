const DB_NAME = 'arkaiv-receipts';
const STORE_NAME = 'attachments';
const DB_VERSION = 1;

interface StoredReceiptAttachment {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

const canUseIndexedDb = () => typeof indexedDB !== 'undefined';

const openDatabase = (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka penyimpanan lampiran.'));
  });
};

export const createReceiptAttachmentId = (): string =>
  `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const saveReceiptAttachment = async (file: File, id = createReceiptAttachmentId()): Promise<string | undefined> => {
  const db = await openDatabase();
  if (!db) return undefined;
  const record: StoredReceiptAttachment = {
    id,
    blob: file,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Gagal menyimpan lampiran.'));
  });
  db.close();
  return id;
};

export const getReceiptAttachment = async (id?: string): Promise<StoredReceiptAttachment | undefined> => {
  if (!id) return undefined;
  const db = await openDatabase();
  if (!db) return undefined;
  const result = await new Promise<StoredReceiptAttachment | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredReceiptAttachment | undefined);
    request.onerror = () => reject(request.error || new Error('Gagal membaca lampiran.'));
  });
  db.close();
  return result;
};

export const getReceiptAttachmentUrl = async (id?: string): Promise<string | undefined> => {
  const stored = await getReceiptAttachment(id);
  return stored?.blob ? URL.createObjectURL(stored.blob) : undefined;
};

export const deleteReceiptAttachment = async (id?: string): Promise<void> => {
  if (!id) return;
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Gagal menghapus lampiran.'));
  });
  db.close();
};

export const createReceiptFingerprint = async (file: File): Promise<string | undefined> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) return undefined;
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};
