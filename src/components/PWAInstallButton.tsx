import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center justify-center gap-2 rounded-xl bg-orange-500 text-slate-950 font-semibold shadow-sm hover:bg-orange-400 active:scale-[0.98] transition whitespace-nowrap shrink-0 ${
          compact ? 'min-h-[40px] px-3 text-xs' : 'w-full min-h-[48px] px-4 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-300 font-semibold hover:bg-orange-500/20 active:scale-[0.98] transition whitespace-nowrap shrink-0 ${
            compact ? 'min-h-[40px] px-3 text-xs' : 'w-full min-h-[48px] px-4 text-sm'
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>Instalar no iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#181c23] p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-100">Instalar no iPhone / iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-3 space-y-2.5 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="font-mono-num text-orange-400 font-bold">1.</span>
                  <span>
                    Toque no botão <strong className="text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5" /> Compartilhar</strong> na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num text-orange-400 font-bold">2.</span>
                  <span>
                    Role para baixo e toque em <strong className="text-white">Adicionar à Tela de Início</strong>.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[48px] rounded-xl bg-orange-500 text-slate-950 font-semibold text-sm hover:bg-orange-400 transition"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
