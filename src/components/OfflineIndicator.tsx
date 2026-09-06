import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-amber-500/95 px-4 py-2 text-xs font-semibold text-white shadow-lg max-w-[min(92vw,22rem)]"
      id="offline-indicator"
      role="status"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span className="leading-snug">Offline — playing saved puzzles</span>
    </div>
  );
};
