import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as standalone, do not display install buttons
  if (isInstalled) {
    return null;
  }

  // Chromium, Android, and Desktop installation flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold shadow-md transition-all active:scale-95 duration-200 cursor-pointer"
        id="pwa-install-btn"
      >
        <Download className="w-4 h-4" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (since iOS Safari doesn't support beforeinstallprompt)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 text-sm font-semibold transition active:scale-95 cursor-pointer"
          id="ios-install-btn"
        >
          <Smartphone className="w-4 h-4" />
          <span>Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-gray-900">Install on Apple iOS</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-full p-1 hover:bg-gray-100 text-gray-500 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 text-sm text-gray-600 space-y-4">
                <p>
                  To install **Mandarin Rescue** as a standalone app on your iPhone or iPad:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-gray-700 font-medium">
                  <li>
                    Tap the <strong className="text-blue-600">Share</strong> button in Safari (represented by a square with an upward arrow at the bottom toolbar).
                  </li>
                  <li>
                    Scroll down and select <strong className="text-blue-600">Add to Home Screen</strong>.
                  </li>
                  <li>
                    Confirm by clicking <strong className="text-blue-600">Add</strong> at the top right corner.
                  </li>
                </ol>
                <p className="text-xs text-gray-400 italic">
                  Note: This option is only available when browsing via the Safari browser.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition active:scale-95 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
