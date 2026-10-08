import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, Smartphone, Laptop, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPwaBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
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
      setShowBanner(false);
      setShowGuideModal(false);
    };
    window.addEventListener('appinstalled', installedHandler);

    // Custom event to trigger install popup from header/settings
    const openInstallHandler = () => {
      setShowBanner(false);
      setShowGuideModal(true);
    };
    window.addEventListener('open-install-pwa', openInstallHandler);

    // Auto-show banner after 2.5 seconds on any device if not recently dismissed
    const dismissedAt = localStorage.getItem('pwa_dismissed_at');
    const dismissedRecently = dismissedAt && Date.now() - Number(dismissedAt) < 1000 * 60 * 60 * 24; // 24 hours

    let timer: number | undefined;
    if (!dismissedRecently) {
      timer = window.setTimeout(() => {
        setShowBanner(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', promptHandler);
      window.removeEventListener('appinstalled', installedHandler);
      window.removeEventListener('open-install-pwa', openInstallHandler);
      if (timer) clearTimeout(timer);
    };
  }, [installed]);

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_dismissed_at', String(Date.now()));
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setShowBanner(false);
          setInstalled(true);
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn('Native install prompt failed, opening guide:', err);
      }
    }

    // If native prompt is not available or device is iOS/desktop Safari/Firefox, show tailored visual guide
    setShowBanner(false);
    setShowGuideModal(true);
  };

  if (installed) return null;

  return (
    <>
      {/* Floating Bottom / Card Install Pop-up for ANY Device */}
      {showBanner && (
        <div className="fixed bottom-20 sm:bottom-6 inset-x-4 max-w-md mx-auto z-40 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="bg-gradient-to-r from-slate-900/95 via-indigo-950/90 to-slate-900/95 border border-indigo-500/50 rounded-2xl p-4 shadow-2xl shadow-indigo-950/70 backdrop-blur-xl flex items-center justify-between gap-3 ring-1 ring-white/10">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
                {deviceInfo.isDesktop ? (
                  <Monitor className="w-6 h-6 text-white" />
                ) : (
                  <Smartphone className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                  Install VoiceTasks App
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">PWA</span>
                </h4>
                <p className="text-xs text-slate-300 truncate">
                  {deviceInfo.isDesktop
                    ? 'Install on desktop for fast voice access'
                    : 'Add to Home Screen for instant 1-tap recording'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Step-by-Step Installation Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  {deviceInfo.isDesktop ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Install VoiceTasks App</h3>
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
              Install VoiceTasks directly onto your device for offline support, fast microphone access, and zero address bar clutter.
            </div>

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
                {deferredPrompt ? (
                  <button
                    onClick={async () => {
                      if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const c = await deferredPrompt.userChoice;
                        if (c.outcome === 'accepted') {
                          setShowGuideModal(false);
                          setInstalled(true);
                        }
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg mb-2"
                  >
                    <Download className="w-4 h-4" /> Tap Here to Install Immediately
                  </button>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        1
                      </span>
                      <p className="text-slate-300">
                        Tap the <strong className="text-white">three dots menu (⋮)</strong> in the top-right corner of Chrome / your browser.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        2
                      </span>
                      <p className="text-slate-300">
                        Select <strong className="text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"><Download className="w-3 h-3 text-indigo-400" /> Install app</strong> or <strong>Add to Home screen</strong>.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Desktop (Chrome / Edge / Mac) Instructions */}
            {deviceInfo.isDesktop && (
              <div className="space-y-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 text-xs">
                {deferredPrompt && (
                  <button
                    onClick={async () => {
                      deferredPrompt.prompt();
                      const c = await deferredPrompt.userChoice;
                      if (c.outcome === 'accepted') {
                        setShowGuideModal(false);
                        setInstalled(true);
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg mb-2"
                  >
                    <Download className="w-4 h-4" /> Click to Install VoiceTasks on Desktop
                  </button>
                )}
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
                    Click the <strong className="text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700"><Download className="w-3 h-3 text-indigo-400" /> Install VoiceTasks</strong> icon, or click menu (⋮) → <strong>"Install VoiceTasks AI"</strong>.
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
