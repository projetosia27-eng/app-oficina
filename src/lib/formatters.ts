import type { Cliente, Oficina, Orcamento, OrcamentoItem, Veiculo } from '../types';

export function formatBRL(value: number | string | null | undefined): string {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatKm(km: number | null | undefined): string {
  const num = Number(km) || 0;
  return `${num.toLocaleString('pt-BR')} km`;
}

export function normalizePlaca(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

export function formatPlacaDisplay(placa: string | null | undefined): string {
  if (!placa) return '---';
  const clean = normalizePlaca(placa);
  if (clean.length === 7 && /^[A-Z]{3}[0-9]{4}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
}

export function sanitizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function calcQuoteTotals(items: OrcamentoItem[], desconto: number) {
  let subtotalPecas = 0;
  let subtotalMaoDeObra = 0;

  for (const item of items) {
    const line = (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0);
    if (item.tipo === 'peca') {
      subtotalPecas += line;
    } else {
      subtotalMaoDeObra += line;
    }
  }

  const desc = Math.max(0, Number(desconto) || 0);
  const total = Math.max(0, subtotalPecas + subtotalMaoDeObra - desc);

  return {
    subtotalPecas,
    subtotalMaoDeObra,
    desconto: desc,
    total,
  };
}

export function buildSupplierQuoteWhatsAppUrl(params: {
  supplierPhone: string;
  supplierName: string;
  partName: string;
  quantity: number;
  veiculo?: Veiculo | null;
}): string {
  const phone = sanitizePhoneForWhatsApp(params.supplierPhone);
  const carParts = params.veiculo
    ? `${params.veiculo.marca} ${params.veiculo.modelo} ${params.veiculo.ano} (Placa ${formatPlacaDisplay(params.veiculo.placa)})`.trim()
    : 'Veículo não informado';

  const msg =
    `Olá ${params.supplierName || 'parceiro'}! Tudo bem?\n` +
    `Preciso de cotação para a seguinte peça:\n` +
    `• Peça: ${params.quantity}x ${params.partName}\n` +
    `• Veículo: ${carParts}\n` +
    `Qual o valor e prazo de entrega?`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function buildClientQuoteWhatsAppUrl(params: {
  cliente?: Cliente | null;
  veiculo?: Veiculo | null;
  oficina?: Oficina | null;
  orcamento: Orcamento;
  items: OrcamentoItem[];
}): string {
  const phone = sanitizePhoneForWhatsApp(params.cliente?.telefone || '');
  const totals = calcQuoteTotals(params.items, params.orcamento.desconto);
  const oficinaNome = params.oficina?.nome || 'OficinaPro';
  const carro = params.veiculo
    ? `${params.veiculo.marca} ${params.veiculo.modelo} ${params.veiculo.ano} (${formatPlacaDisplay(params.veiculo.placa)})`
    : 'Veículo';

  const linhas = params.items
    .map(
      (i) =>
        `- ${i.tipo === 'peca' ? '[Peça]' : '[M.O.]'} ${i.descricao} (${i.quantidade}x ${formatBRL(i.valor_unitario)})`
    )
    .join('\n');

  const msg =
    `*ORÇAMENTO — ${oficinaNome}*\n` +
    `Cliente: ${params.cliente?.nome || '-'}\n` +
    `Veículo: ${carro}\n\n` +
    `*Itens:*\n${linhas || 'Nenhum item lançado'}\n\n` +
    `Peças: ${formatBRL(totals.subtotalPecas)}\n` +
    `Mão de obra: ${formatBRL(totals.subtotalMaoDeObra)}\n` +
    (totals.desconto > 0 ? `Desconto: -${formatBRL(totals.desconto)}\n` : '') +
    `*Total: ${formatBRL(totals.total)}*\n` +
    `Validade: ${params.orcamento.validade_dias} dias` +
    (params.orcamento.observacoes ? `\nObs.: ${params.orcamento.observacoes}` : '');

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function buildClientEmailMailtoUrl(params: {
  cliente?: Cliente | null;
  veiculo?: Veiculo | null;
  oficina?: Oficina | null;
  orcamento: Orcamento;
  items: OrcamentoItem[];
}): string {
  const email = params.cliente?.email || '';
  const totals = calcQuoteTotals(params.items, params.orcamento.desconto);
  const oficinaNome = params.oficina?.nome || 'OficinaPro';
  const placa = formatPlacaDisplay(params.veiculo?.placa);
  const subject = `Orçamento ${placa} — ${oficinaNome}`;

  const body =
    `Olá ${params.cliente?.nome || ''},\n\n` +
    `Segue em anexo o PDF do orçamento para o veículo ${params.veiculo?.marca || ''} ${params.veiculo?.modelo || ''} (${placa}).\n\n` +
    `Resumo:\n` +
    `Peças: ${formatBRL(totals.subtotalPecas)}\n` +
    `Mão de obra: ${formatBRL(totals.subtotalMaoDeObra)}\n` +
    (totals.desconto > 0 ? `Desconto: -${formatBRL(totals.desconto)}\n` : '') +
    `Total: ${formatBRL(totals.total)}\n` +
    `Validade do orçamento: ${params.orcamento.validade_dias} dias.\n\n` +
    `Qualquer dúvida estamos à disposição!\n` +
    `${oficinaNome}${params.oficina?.telefone ? ` · ${params.oficina.telefone}` : ''}`;

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
