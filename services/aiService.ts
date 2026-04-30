import { GoogleGenAI } from '@google/genai';

const GEMINI_SETTINGS_KEY = 'braindump_gemini_key';

export const DEFAULT_FLASH_MODEL = 'gemini-2.5-flash';
export const DEFAULT_PRO_MODEL = 'gemini-2.5-pro';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function canUseStorage() {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis;
}

function readBrowserStorage(key: string): string {
  if (!canUseStorage()) {
    return '';
  }

  try {
    const value = globalThis.localStorage?.getItem(key);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

function readProcessEnv(key: string): string {
  try {
    if (typeof process === 'undefined' || !process?.env) return '';
    const value = process.env[key];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export const getGeminiKey = (): string => {
  return readBrowserStorage(GEMINI_SETTINGS_KEY) || readProcessEnv('GEMINI_API_KEY') || '';
};

export const saveGeminiKey = (key: string) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    if (key) {
      globalThis.localStorage?.setItem(GEMINI_SETTINGS_KEY, key);
    } else {
      globalThis.localStorage?.removeItem(GEMINI_SETTINGS_KEY);
    }
  } catch {
    // Ignore storage errors so AI features can still use env-backed keys.
  }
};

export const createGeminiClient = (apiKey = getGeminiKey()) => {
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
};

export const isRetryableAiError = (error: any) => {
  const status = error?.status || error?.response?.status || error?.cause?.status;
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
};

export async function withAiRetry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number; shouldRetry?: (error: any) => boolean } = {}
): Promise<T> {
  const {
    retries = 2,
    baseDelayMs = 800,
    shouldRetry = isRetryableAiError,
  } = options;

  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await wait(delay);
    }
  }

  throw lastError;
}

function tryJsonParse<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function extractBalancedJson(text: string, openChar: '{' | '['): string | undefined {
  const closeChar = openChar === '{' ? '}' : ']';
  const start = text.indexOf(openChar);
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === '\\') {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) depth += 1;
    if (char === closeChar) depth -= 1;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return undefined;
}

export const parseJsonResponse = <T>(text: string | undefined, fallback: T): T => {
  if (!text || !text.trim()) return fallback;

  const trimmed = text.trim();

  const direct = tryJsonParse<T>(trimmed);
  if (direct !== undefined) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = tryJsonParse<T>(fenced[1].trim());
    if (parsed !== undefined) return parsed;
  }

  const objectCandidate = extractBalancedJson(trimmed, '{');
  if (objectCandidate) {
    const parsed = tryJsonParse<T>(objectCandidate);
    if (parsed !== undefined) return parsed;
  }

  const arrayCandidate = extractBalancedJson(trimmed, '[');
  if (arrayCandidate) {
    const parsed = tryJsonParse<T>(arrayCandidate);
    if (parsed !== undefined) return parsed;
  }

  return fallback;
};
