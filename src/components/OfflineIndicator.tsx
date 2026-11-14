import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/95 px-4 py-2.5 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur-sm"
    >
      <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
      <span>Modo offline — algumas ações dependem de conexão com o Supabase.</span>
    </div>
  );
};
