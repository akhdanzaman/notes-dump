import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppSettings } from '../types';
import type { ShowAppNotice } from './useAppFeedback';
import { LocalSecuritySettings, SecurityPasswordRequestOptions, loadLocalSecuritySettings, saveLocalSecuritySettings } from '../utils/securitySettings';
import { encryptSecurityPassword, fetchSecurityPasswordHash, saveSecurityPasswordHash, verifySecurityPassword } from '../services/spreadsheetService';

export function useAppSecurity(appSettings: AppSettings, setAppSettings: Dispatch<SetStateAction<AppSettings>>, showAppNotice: ShowAppNotice) {
  const pendingPassword = useRef<((password: string | null) => void) | null>(null);
  useEffect(() => () => { pendingPassword.current?.(null); pendingPassword.current = null; }, []);
  const [securitySettings, setSecuritySettingsState] = useState<LocalSecuritySettings>(() =>
    loadLocalSecuritySettings(),
  );
  const [lockedSecurityPopup, setLockedSecurityPopup] = useState<{
    target: keyof LocalSecuritySettings;
    message: string;
  } | null>(null);
  const [securityPasswordDialog, setSecurityPasswordDialog] = useState<{
    mode: 'create' | 'verify';
    title: string;
    message: string;
    resolve: (password: string | null) => void;
  } | null>(null);
  const setSecuritySettings = (next: LocalSecuritySettings) => {
    setSecuritySettingsState(next);
    saveLocalSecuritySettings(next);
  };

  const openLockedSecurityPopup = (target: keyof LocalSecuritySettings, message: string) => {
    setLockedSecurityPopup({ target, message });
  };

  const requestSecurityPassword = (
    mode: 'create' | 'verify',
    title: string,
    message: string,
  ) => new Promise<string | null>((resolve) => {
    pendingPassword.current?.(null);
    pendingPassword.current = resolve;
    setSecurityPasswordDialog({ mode, title, message, resolve });
  });

  const closeSecurityPasswordDialog = (password: string | null) => {
    const resolve = pendingPassword.current;
    pendingPassword.current = null;
    setSecurityPasswordDialog(null);
    resolve?.(password);
  };

  const authorizeSecurityPassword = async (
    options: SecurityPasswordRequestOptions = {},
  ): Promise<boolean> => {
    const allowCreate = options.allowCreate ?? false;
    let encryptedPassword = appSettings.securityPasswordHash || null;

    try {
      if (!encryptedPassword) {
        encryptedPassword = await fetchSecurityPasswordHash();
      }
    } catch (error) {
      console.error('Failed to load security password', error);
      showAppNotice('Password keamanan tidak dapat dimuat. Periksa koneksi Google Sheets.', 'error');
      return false;
    }

    if (!encryptedPassword) {
      if (!allowCreate) {
        showAppNotice('Password keamanan belum dibuat.', 'error');
        return false;
      }

      const createdPassword = await requestSecurityPassword(
        'create',
        'Buat password keamanan',
        'Password ini digunakan untuk mengubah pengaturan keamanan pada perangkat ini.',
      );
      if (!createdPassword) return false;

      const newEncryptedPassword = encryptSecurityPassword(createdPassword);
      try {
        await saveSecurityPasswordHash(newEncryptedPassword);
      } catch (error) {
        console.error('Failed to save security password', error);
        showAppNotice('Password keamanan tidak dapat disimpan ke Themes & Settings.', 'error');
        return false;
      }

      setAppSettings(current => ({ ...current, securityPasswordHash: newEncryptedPassword }));
      showAppNotice('Password keamanan berhasil dibuat.', 'success');
      return true;
    }

    if (!appSettings.securityPasswordHash) {
      setAppSettings(current => ({ ...current, securityPasswordHash: encryptedPassword || undefined }));
    }

    const actionLabel = options.actionLabel || 'mengubah pengaturan keamanan ini';
    const enteredPassword = await requestSecurityPassword(
      'verify',
      'Konfirmasi password',
      `Masukkan password untuk ${actionLabel}.`,
    );
    if (enteredPassword === null) return false;
    if (!verifySecurityPassword(enteredPassword, encryptedPassword)) {
      showAppNotice('Password salah.', 'error');
      return false;
    }

    return true;
  };

  const handleDisableLockedSecurity = async () => {
    if (!lockedSecurityPopup) return;
    const ok = await authorizeSecurityPassword({
      allowCreate: false,
      actionLabel: 'disable this security setting',
    });
    if (!ok) return;

    setSecuritySettings({
      ...securitySettings,
      [lockedSecurityPopup.target]: false,
    });
    setLockedSecurityPopup(null);
  };


  return { securitySettings, setSecuritySettings, lockedSecurityPopup, setLockedSecurityPopup, securityPasswordDialog, openLockedSecurityPopup, closeSecurityPasswordDialog, authorizeSecurityPassword, handleDisableLockedSecurity };
}
