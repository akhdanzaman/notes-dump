import { SpreadsheetConfig } from './spreadsheetService';

export interface GoogleProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export interface AppConfig {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  theme?: 'light' | 'dark';
  // Add other settings here
}

const CONFIG_FILE_NAME = 'braindump_config.json';

export const fetchGoogleProfile = async (accessToken: string): Promise<GoogleProfile> => {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user profile');
  return res.json();
};

export const findConfigFile = async (accessToken: string): Promise<string | null> => {
  const query = `name = '${CONFIG_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to search for config file');
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
};

export const readConfigFile = async (fileId: string, accessToken: string): Promise<AppConfig | null> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
};

export const createConfigFile = async (config: AppConfig, accessToken: string): Promise<string> => {
  const metadata = {
    name: CONFIG_FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  
  const boundary = '-------314159265358979323846';
  const delimiter = "\\r\\n--" + boundary + "\\r\\n";
  const close_delim = "\\r\\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json\\r\\n\\r\\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\\r\\n\\r\\n' +
    JSON.stringify(config) +
    close_delim;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody,
  });
  
  if (!res.ok) {
      const err = await res.text();
      console.error("Drive upload error:", err);
      throw new Error('Failed to create config file');
  }
  const data = await res.json();
  return data.id;
};

export const updateConfigFile = async (fileId: string, config: AppConfig, accessToken: string): Promise<void> => {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config),
  });
  
  if (!res.ok) throw new Error('Failed to update config file');
};

export const saveConfigToDrive = async (config: AppConfig, accessToken: string) => {
  try {
    let fileId = await findConfigFile(accessToken);
    if (fileId) {
      await updateConfigFile(fileId, config, accessToken);
    } else {
      await createConfigFile(config, accessToken);
    }
  } catch (error) {
    console.error('Error saving config to Drive:', error);
  }
};

export const loadConfigFromDrive = async (accessToken: string): Promise<AppConfig | null> => {
  try {
    const fileId = await findConfigFile(accessToken);
    if (fileId) {
      return await readConfigFile(fileId, accessToken);
    }
  } catch (error) {
    console.error('Error loading config from Drive:', error);
  }
  return null;
};

export const saveGoogleSession = (tokens: any) => {
    const existingStr = localStorage.getItem('braindump_google_session');
    let existing = null;
    if (existingStr) {
        try { existing = JSON.parse(existingStr); } catch(e) {}
    }
    
    const refreshToken = tokens.refresh_token || (existing ? existing.refresh_token : undefined);

    // Default to 1 hour if expires_in is missing or invalid
    const expiresIn = (typeof tokens.expires_in === 'number' && tokens.expires_in > 0) 
        ? tokens.expires_in 
        : 3600;
        
    localStorage.setItem('braindump_google_session', JSON.stringify({
        ...tokens,
        refresh_token: refreshToken,
        expires_at: Date.now() + (expiresIn * 1000)
    }));
};

export const getGoogleSession = () => {
    const session = localStorage.getItem('braindump_google_session');
    if (!session) return null;
    try {
        const parsed = JSON.parse(session);
        if (Date.now() > parsed.expires_at) {
            // Token expired
            return null;
        }
        return parsed;
    } catch (e) {
        return null;
    }
};

export const clearGoogleSession = () => {
    localStorage.removeItem('braindump_google_session');
};
