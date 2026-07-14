import { notifyUser } from './uiFeedback';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const getNotificationSettings = () => {
  try {
    const settings = JSON.parse(localStorage.getItem('braindump_app_settings') || '{}');
    return settings;
  } catch (e) {
    return {};
  }
};

export const applyNotificationMode = (options: any, mode?: string) => {
  const m = mode || 'both';
  if (m === 'silent') {
    options.silent = true;
    delete options.vibrate;
  } else if (m === 'vibrate') {
    options.silent = true;
    options.vibrate = [200, 100, 200];
  } else if (m === 'sound') {
    options.silent = false;
    delete options.vibrate;
  } else {
    options.silent = false;
    options.vibrate = [200, 100, 200];
  }
  return options;
};

export const showPromptNotification = async () => {
  if (!('serviceWorker' in navigator)) return;
  
  if (Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const settings = getNotificationSettings();
      
      const options = applyNotificationMode({
        body: 'What are you thinking about right now?',
        icon: '/icon.svg',
        badge: '/mask-icon.svg',
        tag: 'braindump-prompt',
        renotify: true,
        requireInteraction: true,
        actions: [
          {
            action: 'reply',
            type: 'text',
            title: 'Reply'
          }
        ]
      }, settings.notificationMode);

      registration.showNotification('Arkaiv', options as any);
    } catch (e) {
      console.error('Failed to show notification', e);
    }
  }
};

export const sendTestNotification = async (customSettings?: any) => {
  if (!('serviceWorker' in navigator)) {
    notifyUser('Service Worker tidak didukung oleh browser ini.', 'error');
    return;
  }
  
  if (Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const settings = customSettings || getNotificationSettings();
      
      const options = applyNotificationMode({
        body: 'This is a test notification. It works!',
        icon: '/icon.svg',
        badge: '/mask-icon.svg',
        tag: 'braindump-test'
      }, settings.notificationMode);

      registration.showNotification('Arkaiv Test', options as any);
    } catch (e) {
      console.error('Failed to show test notification', e);
      notifyUser('Notifikasi uji gagal ditampilkan.', 'error');
    }
  } else {
    notifyUser('Izin notifikasi belum diberikan.', 'error');
  }
};

export const updatePersistentNotification = async (enabled: boolean) => {
  if (!('serviceWorker' in navigator)) return;
  if (Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({ tag: 'braindump-persistent' });
      
      if (enabled) {
        if (notifications.length === 0) {
          const settings = getNotificationSettings();
          const options = applyNotificationMode({
            body: 'Type your thoughts here...',
            icon: '/icon.svg',
            badge: '/mask-icon.svg',
            tag: 'braindump-persistent',
            renotify: false,
            requireInteraction: true,
            actions: [
              {
                action: 'reply',
                type: 'text',
                title: 'Quick Input'
              }
            ]
          }, settings.notificationMode);
          
          registration.showNotification('Arkaiv Quick Input', options as any);
        }
      } else {
        notifications.forEach(n => n.close());
      }
    } catch (e) {
      console.error('Failed to update persistent notification', e);
    }
  }
};
