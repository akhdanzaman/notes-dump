import { GoogleGenAI } from '@google/genai';

const GEMINI_SETTINGS_KEY = 'braindump_gemini_key';

export const DEFAULT_FLASH_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_PRO_MODEL = 'gemini-3.1-pro-preview';

function readBrowserStorage(key: string): string {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return '';
  }

  try {
    const value = globalThis.localStorage?.getItem(key);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export const getGeminiKey = (): string => {
  return readBrowserStorage(GEMINI_SETTINGS_KEY) || process.env.GEMINI_API_KEY || '';
};

export const saveGeminiKey = (key: string) => {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
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

export const createGeminiClient = () => {
  const apiKey = getGeminiKey();
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
};

export const parseJsonResponse = <T>(text: string | undefined, fallback: T): T => {
  if (!text || !text.trim()) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1]) as T;
      } catch {
        // fall through
      }
    }

    const objectStart = text.indexOf('{');
    const objectEnd = text.lastIndexOf('}');
    if (objectStart !== -1 && objectEnd > objectStart) {
      try {
        return JSON.parse(text.slice(objectStart, objectEnd + 1)) as T;
      } catch {
        // fall through
      }
    }

    const arrayStart = text.indexOf('[');
    const arrayEnd = text.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      try {
        return JSON.parse(text.slice(arrayStart, arrayEnd + 1)) as T;
      } catch {
        // fall through
      }
    }
  }

  return fallback;
};
