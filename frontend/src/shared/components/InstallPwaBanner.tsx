import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, Smartphone, Laptop } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPwaBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://')
    );
  });

  // Device detection
  const [deviceInfo] = useState<{
    isIOS: boolean;
    isAndroid: boolean;
    isDesktop: boolean;
    browserName: string;
  }>(() => {
    if (typeof window === 'undefined') {
      return { isIOS: false, isAndroid: false, isDesktop: true, browserName: 'browser' };
    }
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    const isDesktopDevice = !isIOSDevice && !isAndroidDevice;

    let browser = 'Browser';
    if (/edg/.test(ua)) browser = 'Edge';
    else if (/chrome|crios/.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/.test(ua)) browser = 'Firefox';
    else if (/safari/.test(ua)) browser = 'Safari';

    return {
      isIOS: isIOSDevice,
      isAndroid: isAndroidDevice,
      isDesktop: isDesktopDevice,
      browserName: browser,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined' || installed) return;

    // Capture native PWA install prompt
    const promptHandler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', promptHandler);

    // Track app installed event
    const installedHandler = () => {
      setInstalled(true);
      setShowGuideModal(false);
    };
    window.addEventListener('appinstalled', installedHandler);

    // Custom event to trigger install popup from header/settings
    const openInstallHandler = () => {
      setShowGuideModal(true);
    };
    window.addEventListener('open-install-pwa', openInstallHandler);


    return () => {
      window.removeEventListener('beforeinstallprompt', promptHandler);
      window.removeEventListener('appinstalled', installedHandler);
      window.removeEventListener('open-install-pwa', openInstallHandler);
    };
  }, [installed]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          setShowGuideModal(false);
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn('Native install prompt failed, opening guide:', err);
      }
    }

    // If native prompt is not available or device is iOS/desktop Safari/Firefox, show tailored visual guide
    setShowGuideModal(true);
  };

  if (installed) return null;

  return (
    <>
      {/* Universal Step-by-Step Installation Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="install-title">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  {deviceInfo.isDesktop ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div>
                  <h3 id="install-title" className="text-base font-bold text-white">Install VocaTask App</h3>
                  <p className="text-xs text-slate-400">
                    {deviceInfo.isIOS ? 'iPhone & iPad (Safari)' : deviceInfo.isAndroid ? 'Android Device' : `${deviceInfo.browserName} on Computer`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Install VocaTask directly onto your device for offline support, fast microphone access, and zero address bar clutter.
            </div>

            {deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" /> Install VocaTask
              </button>
            )}

            {/* iOS Instructions */}
            {deviceInfo.isIOS && (
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="text-slate-300">
                    Tap the <strong className="text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"><Share2 className="w-3 h-3 text-indigo-400" /> Share</strong> button at the bottom of Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="text-slate-300">
                    Scroll down and tap <strong className="text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"><PlusSquare className="w-3 h-3 text-indigo-400" /> Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="text-slate-300">
                    Tap <strong className="text-white font-semibold">Add</strong> in the top right corner. The app will appear on your Home Screen!
                  </p>
                </div>
              </div>
            )}

            {/* Android Instructions */}
            {deviceInfo.isAndroid && (
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-slate-300">Tap the <strong className="text-white">three dots menu (⋮)</strong> in the top-right corner of Chrome / your browser.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-slate-300">Select <strong className="text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"><Download className="w-3 h-3 text-indigo-400" /> Install app</strong> or <strong>Add to Home screen</strong>.</p>
                </div>
              </div>
            )}

            {/* Desktop (Chrome / Edge / Mac) Instructions */}
            {deviceInfo.isDesktop && (
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 text-xs">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="text-slate-300">
                    Look at the right side of your browser's address bar (URL bar).
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <p className="text-slate-300">
                    Click the <strong className="text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"><Download className="w-3 h-3 text-indigo-400" /> Install VocaTask</strong> icon, or click menu (⋮) → <strong>"Install VocaTask"</strong>.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
