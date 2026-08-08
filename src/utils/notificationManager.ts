import { UserNotification } from '../types';

export function triggerNotification(title: string, message: string) {
  // Dispatch custom in-app event for toast rendering
  window.dispatchEvent(
    new CustomEvent('kreational-notification', {
      detail: { title, message, timestamp: Date.now() },
    })
  );

  // Trigger Device/Browser Notification API if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: '/pwa-192x192.png',
      });
    } catch (e) {
      console.warn('Browser notification trigger failed:', e);
    }
  }
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(console.warn);
  }
}
