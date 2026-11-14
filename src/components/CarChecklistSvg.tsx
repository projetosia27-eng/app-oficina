import React from 'react';
import { CAR_AREAS } from '../data/checklistData';
import type { AreaId } from '../types';

interface CarChecklistSvgProps {
  selectedCounts: Record<string, number>;
  notesByArea: Record<string, string>;
  onSelectArea: (areaId: AreaId) => void;
}

interface HotspotConfig {
  id: AreaId;
  label: string;
  cx: number;
  cy: number;
  r?: number;
}

const HOTSPOTS: HotspotConfig[] = [
  { id: 'motor', label: 'Motor', cx: 180, cy: 108, r: 28 },
  { id: 'eletrica', label: 'Elétrica', cx: 112, cy: 84, r: 22 },
  { id: 'direcao', label: 'Direção', cx: 145, cy: 168, r: 22 },
  { id: 'cambio', label: 'Câmbio', cx: 180, cy: 196, r: 24 },
  { id: 'ar_condicionado', label: 'Ar-cond.', cx: 218, cy: 168, r: 22 },
  { id: 'freios', label: 'Freios', cx: 88, cy: 145, r: 23 },
  { id: 'pneus', label: 'Pneus', cx: 272, cy: 145, r: 23 },
  { id: 'suspensao', label: 'Suspensão', cx: 88, cy: 355, r: 24 },
  { id: 'escapamento', label: 'Escape', cx: 180, cy: 416, r: 26 },
];

export const CarChecklistSvg: React.FC<CarChecklistSvgProps> = ({
  selectedCounts,
  notesByArea,
  onSelectArea,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Diagrama Técnico Interativo do Veículo */}
      <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#141820] p-4 flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400">
            Toque na área do veículo
          </span>
          <span className="text-xs text-orange-400 font-medium">
            9 sistemas inspecionáveis
          </span>
        </div>

        <svg
          viewBox="0 0 360 470"
          className="w-full max-w-[300px] h-auto select-none touch-manipulation"
          role="img"
          aria-label="Diagrama interativo de inspeção do carro"
        >
          <defs>
            <linearGradient id="carBodyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#262c38" />
              <stop offset="50%" stopColor="#1c212b" />
              <stop offset="100%" stopColor="#161a22" />
            </linearGradient>
          </defs>

          {/* Grade sutil de oficina */}
          <line x1="180" y1="20" x2="180" y2="450" stroke="#232936" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="40" y1="145" x2="320" y2="145" stroke="#232936" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="40" y1="355" x2="320" y2="355" stroke="#232936" strokeWidth="1" strokeDasharray="4 4" />

          {/* Rodas / Pneus */}
          <rect x="66" y="112" width="24" height="64" rx="7" fill="#0f1218" stroke="#475569" strokeWidth="2" />
          <rect x="270" y="112" width="24" height="64" rx="7" fill="#0f1218" stroke="#475569" strokeWidth="2" />
          <rect x="66" y="322" width="24" height="64" rx="7" fill="#0f1218" stroke="#475569" strokeWidth="2" />
          <rect x="270" y="322" width="24" height="64" rx="7" fill="#0f1218" stroke="#475569" strokeWidth="2" />

          {/* Eixos */}
          <line x1="90" y1="144" x2="270" y2="144" stroke="#334155" strokeWidth="4" />
          <line x1="90" y1="354" x2="270" y2="354" stroke="#334155" strokeWidth="4" />

          {/* Silhueta da Carroceria (Vista Superior) */}
          <path
            d="M 105 56 Q 105 32 180 32 Q 255 32 255 56 L 266 130 L 266 378 Q 266 426 244 434 L 116 434 Q 94 426 94 378 L 94 130 Z"
            fill="url(#carBodyGrad)"
            stroke="#475569"
            strokeWidth="2.5"
          />

          {/* Capô / Para-brisa / Teto / Vidro traseiro */}
          <path
            d="M 114 156 Q 180 142 246 156 L 236 218 L 124 218 Z"
            fill="#0f131a"
            stroke="#334155"
            strokeWidth="1.5"
          />
          <rect x="122" y="222" width="116" height="106" rx="14" fill="#181d26" stroke="#334155" strokeWidth="1.5" />
          <path
            d="M 124 334 L 236 334 L 244 382 Q 180 392 116 382 Z"
            fill="#0f131a"
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Faróis e Lanternas */}
          <path d="M 108 46 Q 124 38 140 42" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M 220 42 Q 236 38 252 46" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M 108 424 L 136 426" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
          <path d="M 224 426 L 252 424" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />

          {/* Hotspots Tocáveis */}
          {HOTSPOTS.map((spot) => {
            const count = selectedCounts[spot.id] || 0;
            const hasNote = Boolean(notesByArea[spot.id]?.trim());
            const active = count > 0 || hasNote;
            const r = spot.r || 24;

            return (
              <g
                key={spot.id}
                onClick={() => onSelectArea(spot.id)}
                className="cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label={`Inspecionar ${spot.label}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectArea(spot.id);
                  }
                }}
              >
                <circle
                  cx={spot.cx}
                  cy={spot.cy}
                  r={r}
                  fill={active ? 'rgba(249, 115, 22, 0.25)' : 'rgba(15, 23, 42, 0.72)'}
                  stroke={active ? '#f97316' : '#64748b'}
                  strokeWidth={active ? 2.5 : 1.5}
                  className="transition-colors group-hover:stroke-orange-400"
                />
                <text
                  x={spot.cx}
                  y={count > 0 ? spot.cy - 2 : spot.cy + 4}
                  textAnchor="middle"
                  fill={active ? '#fed7aa' : '#e2e8f0'}
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {spot.label}
                </text>
                {count > 0 && (
                  <text
                    x={spot.cx}
                    y={spot.cy + 12}
                    textAnchor="middle"
                    fill="#f97316"
                    fontSize="11"
                    fontWeight="800"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {count} {count === 1 ? 'item' : 'itens'}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Botões Grandes para Dedo Sujo de Graxa */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAR_AREAS.map((area) => {
          const count = selectedCounts[area.id] || 0;
          const hasNote = Boolean(notesByArea[area.id]?.trim());
          const active = count > 0 || hasNote;

          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelectArea(area.id)}
              className={`min-h-[68px] w-full rounded-2xl border p-4 text-left transition active:scale-[0.98] flex items-center justify-between gap-3 ${
                active
                  ? 'border-orange-500/70 bg-orange-500/10'
                  : 'border-slate-800 bg-[#181c23] hover:border-slate-700'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-100">{area.nome}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400 truncate">{area.resumo}</p>
              </div>

              <div className="shrink-0 text-right">
                {count > 0 ? (
                  <span className="font-mono-num text-sm font-bold text-orange-400">
                    {count} {count === 1 ? 'defeito' : 'defeitos'}
                  </span>
                ) : hasNote ? (
                  <span className="text-xs font-semibold text-orange-300">Com obs.</span>
                ) : (
                  <span className="text-xs font-medium text-slate-500">Tocar</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
