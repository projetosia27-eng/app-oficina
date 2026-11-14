import type { AreaId, OrcamentoStatus } from '../types';

export interface CarAreaDefinition {
  id: AreaId;
  nome: string;
  resumo: string;
  defeitosComuns: string[];
}

export const CAR_AREAS: CarAreaDefinition[] = [
  {
    id: 'motor',
    nome: 'Motor',
    resumo: 'Correias, velas, vazamentos e arrefecimento',
    defeitosComuns: [
      'Vazamento de óleo',
      'Correia dentada gasta / trincada',
      'Velas ou bobina com falha',
      'Superaquecimento / vazamento de água',
      'Coxim do motor estourado',
      'Filtro de óleo / ar saturado',
      'Junta da tampa de válvulas vazando',
    ],
  },
  {
    id: 'freios',
    nome: 'Freios',
    resumo: 'Pastilhas, discos, fluido e pinças',
    defeitosComuns: [
      'Pastilha gasta',
      'Disco empenado ou abaixo da medida',
      'Fluido de freio baixo ou contaminado',
      'Ruído ou assobio ao frear',
      'Pinça de freio travando',
      'Lona / tambor traseiro gasto',
      'Flexível de freio ressecado',
    ],
  },
  {
    id: 'suspensao',
    nome: 'Suspensão',
    resumo: 'Amortecedores, molas, buchas e pivôs',
    defeitosComuns: [
      'Amortecedor vazando ou sem ação',
      'Bucha da bandeja estourada',
      'Pivô com folga',
      'Bieleta quebrada ou com folga',
      'Mola cansada ou quebrada',
      'Batente / coifa danificada',
      'Coxim do amortecedor ruidoso',
    ],
  },
  {
    id: 'direcao',
    nome: 'Direção',
    resumo: 'Caixa, terminais, barra axial e bomba',
    defeitosComuns: [
      'Folga na caixa de direção',
      'Terminal de direção gasto',
      'Barra axial com folga',
      'Vazamento de fluido hidráulico',
      'Bomba de direção ruidosa',
      'Necessita alinhamento',
    ],
  },
  {
    id: 'eletrica',
    nome: 'Elétrica',
    resumo: 'Bateria, alternador, partida e sensores',
    defeitosComuns: [
      'Bateria fraca / não segura carga',
      'Alternador não carrega',
      'Motor de partida falhando',
      'Lâmpada / farol queimado',
      'Curto-circuito ou fusível queimado',
      'Falha em sensor / injeção eletrônica',
    ],
  },
  {
    id: 'escapamento',
    nome: 'Escapamento',
    resumo: 'Silencioso, catalisador e juntas',
    defeitosComuns: [
      'Silencioso furado ou podre',
      'Vazamento na junta / coletor',
      'Catalisador entupido ou danificado',
      'Coxim de escape solto ou rompido',
      'Ruído excessivo no escapamento',
      'Sonda lambda com falha',
    ],
  },
  {
    id: 'pneus',
    nome: 'Pneus',
    resumo: 'Banda de rodagem, desgaste e válvulas',
    defeitosComuns: [
      'Pneu careca / no limite TWI',
      'Desgaste irregular (ombro ou centro)',
      'Furo ou bolha lateral',
      'Válvula / bico vazando',
      'Necessita balanceamento e rodízio',
    ],
  },
  {
    id: 'ar_condicionado',
    nome: 'Ar-condicionado',
    resumo: 'Gás, compressor, condensador e filtro',
    defeitosComuns: [
      'Gás baixo / não gela',
      'Compressor com ruído ou travado',
      'Filtro de cabine muito sujo',
      'Vazamento em mangueira ou condensador',
      'Eletroventilador não arma',
    ],
  },
  {
    id: 'cambio',
    nome: 'Câmbio',
    resumo: 'Embreagem, marchas, óleo e homocinética',
    defeitosComuns: [
      'Embreagem patinando ou pedal duro',
      'Dificuldade para engatar marchas',
      'Vazamento de óleo no câmbio',
      'Coifa da homocinética rasgada',
      'Junta homocinética estalando',
      'Atuador / cilindro de embreagem vazando',
    ],
  },
];

export const AREA_MAP: Record<string, CarAreaDefinition> = Object.fromEntries(
  CAR_AREAS.map((area) => [area.id, area])
);

export const STATUS_OPTIONS: {
  value: OrcamentoStatus;
  label: string;
  colorClass: string;
  dotClass: string;
}[] = [
  {
    value: 'rascunho',
    label: 'Rascunho',
    colorClass: 'text-slate-300',
    dotClass: 'bg-slate-400',
  },
  {
    value: 'enviado',
    label: 'Enviado',
    colorClass: 'text-sky-300',
    dotClass: 'bg-sky-400',
  },
  {
    value: 'aprovado',
    label: 'Aprovado',
    colorClass: 'text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  {
    value: 'em_servico',
    label: 'Em serviço',
    colorClass: 'text-orange-300',
    dotClass: 'bg-orange-400',
  },
  {
    value: 'finalizado',
    label: 'Finalizado',
    colorClass: 'text-lime-300',
    dotClass: 'bg-lime-400',
  },
];

export function getStatusInfo(status: OrcamentoStatus) {
  return (
    STATUS_OPTIONS.find((s) => s.value === status) || {
      value: status,
      label: status,
      colorClass: 'text-slate-300',
      dotClass: 'bg-slate-400',
    }
  );
}
