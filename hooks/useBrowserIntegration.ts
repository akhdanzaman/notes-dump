import { useEffect, useRef } from 'react';
import type { AppSettings } from '../types';
import type { ShowAppNotice } from './useAppFeedback';
interface BrowserIntegrationOptions {
  handleSend: (text: string) => Promise<void>;
  loadData: () => Promise<void>;
  appSettings: AppSettings;
  showAppNotice: ShowAppNotice;
}
export function useBrowserIntegration({ handleSend, loadData, appSettings, showAppNotice }: BrowserIntegrationOptions) {
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const replyText = params.get("reply");
    if (!replyText) return;

    const replyKey = `braindump-open-reply:${replyText}`;
    if (sessionStorage.getItem(replyKey) === "handled") return;
    sessionStorage.setItem(replyKey, "handled");

    handleSendRef.current(replyText);
    params.delete("reply");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      const { type, text } = event.data || {};
      if (type === "NOTIFICATION_REPLY" && text) {
        handleSendRef.current(text);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
    };
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const { type, tokens, error } = event.data || {};

      if (type === "GOOGLE_OAUTH_SUCCESS") {
        try {
          // simpan session
          localStorage.setItem(
            "braindump_google_session",
            JSON.stringify({
              ...tokens,
              expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
            }),
          );

          console.log("Google login success");

          // kalau mau, lanjut fetch profile / config di sini
          // const profile = await fetchGoogleProfile(tokens.access_token);
          // const config = await loadConfigFromDrive(tokens.access_token);

          loadData(); // atau trigger refresh state
        } catch (e) {
          console.error("Failed to process OAuth success", e);
        }
      }

      if (type === "GOOGLE_OAUTH_ERROR") {
        console.error("Google login failed:", error);
        showAppNotice(`Login gagal: ${error}`, 'error');
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loadData]);

  // --- Persistent Notification Effect ---
  useEffect(() => {
    import("../utils/notificationHandler").then(
      ({ updatePersistentNotification }) => {
        updatePersistentNotification(!!appSettings.persistentNotification);
      },
    );
  }, [appSettings.persistentNotification]);

  // --- Theme Effect ---
  useEffect(() => {
    const theme = appSettings.theme || "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute("content", theme === "dark" ? "#15221C" : "#F4F6F5");
  }, [appSettings.theme]);

  useEffect(() => {
    document.documentElement.lang = appSettings.language === "en" ? "en" : "id";
  }, [appSettings.language]);


}
