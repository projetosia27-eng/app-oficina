import React, { useState } from 'react';
import { Check, Copy, Database, X } from 'lucide-react';
import { SUPABASE_SETUP_SQL } from '../data/supabaseSql';

interface SqlSetupModalProps {
  open: boolean;
  onClose: () => void;
}

export const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ open, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm"
    >
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-[#141820] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
              <Database className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-100 truncate">
                Script SQL do Supabase (Tabelas + RLS + Storage)
              </h3>
              <p className="text-xs text-slate-400 truncate">
                Execute uma vez no SQL Editor do seu projeto Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0d11] p-4 text-xs leading-relaxed text-slate-300 font-mono-num">
            {SUPABASE_SETUP_SQL}
          </pre>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
          <p className="text-xs text-slate-400">
            Inclui políticas RLS por <code className="text-orange-400">user_id</code> e bucket{' '}
            <code className="text-orange-400">logos</code> limitado a 1 MB.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-none min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition whitespace-nowrap"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'SQL Copiado!' : 'Copiar Script SQL'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
