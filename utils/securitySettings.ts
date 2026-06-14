export interface LocalSecuritySettings {
  lockTabTransaction: boolean;
  forceHideMoneyValue: boolean;
}

export interface SecurityPasswordRequestOptions {
  allowCreate?: boolean;
  actionLabel?: string;
}

export const SECURITY_SETTINGS_STORAGE_KEY = 'braindump_security_settings_v1';

export const DEFAULT_LOCAL_SECURITY_SETTINGS: LocalSecuritySettings = {
  lockTabTransaction: false,
  forceHideMoneyValue: false,
};

export const loadLocalSecuritySettings = (): LocalSecuritySettings => {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCAL_SECURITY_SETTINGS;
  try {
    const raw = localStorage.getItem(SECURITY_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_SECURITY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LocalSecuritySettings>;
    return {
      lockTabTransaction: !!parsed.lockTabTransaction,
      forceHideMoneyValue: !!parsed.forceHideMoneyValue,
    };
  } catch (error) {
    console.warn('Failed to load local security settings', error);
    return DEFAULT_LOCAL_SECURITY_SETTINGS;
  }
};

export const saveLocalSecuritySettings = (settings: LocalSecuritySettings) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SECURITY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save local security settings', error);
  }
};
