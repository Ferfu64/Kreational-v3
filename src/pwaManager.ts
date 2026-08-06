// PWA Service Worker & Install Manager

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners: Set<() => void> = new Set();

export function notifyPwaListeners() {
  listeners.forEach((listener) => listener());
}

export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function canInstallPwa(): boolean {
  return deferredPrompt !== null;
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notifyPwaListeners();
    return choice.outcome === 'accepted';
  } catch (err) {
    console.error('Error prompting PWA install:', err);
    return false;
  }
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notifyPwaListeners();
    console.log('[PWA] beforeinstallprompt event captured');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyPwaListeners();
    console.log('[PWA] Kreational app was installed!');
  });

  // Register service worker if supported
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}
