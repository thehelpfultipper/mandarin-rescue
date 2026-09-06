import React, { useEffect, useId, useRef, useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, Smartphone, X } from 'lucide-react';

/**
 * Unified install affordance — Android/Chromium uses beforeinstallprompt;
 * iOS Safari uses an inkstone-themed Add to Home Screen sheet (no blue/white light UI).
 */
export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showIOSGuide) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSGuide(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [showIOSGuide]);

  if (isInstalled) return null;

  const btnClass =
    'flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#141211] px-4 py-2.5 text-sm font-bold shadow-md transition active:scale-95 min-h-[44px] cursor-pointer w-full sm:w-auto';

  if (isInstallable) {
    return (
      <button type="button" onClick={install} className={btnClass} id="pwa-install-btn">
        <Download className="w-4 h-4" />
        <span>Install app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={btnClass}
          id="ios-install-btn"
          aria-haspopup="dialog"
        >
          <Smartphone className="w-4 h-4" />
          <span>Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-sm"
            role="presentation"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-[#1C1A17] border border-stone-800 p-5 sm:p-6 shadow-2xl text-[#FAF9F6]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-800">
                <div>
                  <h3 id={titleId} className="font-display text-lg font-bold text-[#FAF9F6]">
                    Add to Home Screen
                  </h3>
                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                    Plays like a phone app — full screen, offline-ready rescues.
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[44px] min-w-[44px] -mr-1 -mt-1 inline-flex items-center justify-center rounded-xl text-stone-400 hover:text-[#FAF9F6] hover:bg-stone-800 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="mt-4 space-y-3 text-sm text-stone-300">
                <li className="flex gap-3 items-start">
                  <span className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-stone-900 border border-amber-900/40 text-amber-300">
                    <Share2 className="w-3.5 h-3.5" aria-hidden />
                  </span>
                  <span>
                    Tap <strong className="text-amber-200 font-semibold">Share</strong> in Safari
                    (square with an arrow, bottom center).
                  </span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-stone-900 border border-stone-700 text-[11px] font-black text-stone-300">
                    2
                  </span>
                  <span>
                    Scroll and tap{' '}
                    <strong className="text-amber-200 font-semibold">Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-stone-900 border border-stone-700 text-[11px] font-black text-stone-300">
                    3
                  </span>
                  <span>
                    Tap <strong className="text-amber-200 font-semibold">Add</strong> — open Mandarin
                    Rescue from your home screen next time.
                  </span>
                </li>
              </ol>

              <p className="mt-4 text-[11px] text-stone-500 leading-snug">
                Use Safari (not an in-app browser). On Android Chrome, use Install app when prompted.
              </p>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-[#141211] py-3 text-sm font-bold transition active:scale-95 min-h-[44px] cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
