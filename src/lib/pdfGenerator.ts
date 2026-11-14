import { jsPDF } from 'jspdf';
import { AREA_MAP, getStatusInfo } from '../data/checklistData';
import type { Cliente, Oficina, Orcamento, OrcamentoItem, Veiculo } from '../types';
import { calcQuoteTotals, formatBRL, formatDateBR, formatKm, formatPlacaDisplay } from './formatters';

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface GenerateQuotePdfParams {
  oficina: Oficina | null;
  cliente: Cliente | null;
  veiculo: Veiculo | null;
  orcamento: Orcamento;
  items: OrcamentoItem[];
}

export async function generateQuotePdfBlob(params: GenerateQuotePdfParams): Promise<{
  blob: Blob;
  fileName: string;
}> {
  const { oficina, cliente, veiculo, orcamento, items } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  let y = 14;

  // Cabeçalho escuro com barra laranja
  doc.setFillColor(15, 17, 21);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 38.5, pageWidth, 1.5, 'F');

  let textStartX = margin;
  if (oficina?.logo_url) {
    const logoData = await loadImageAsDataUrl(oficina.logo_url);
    if (logoData) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, 7, 24, 24, 2, 2, 'F');
        doc.addImage(logoData, margin + 1, 8, 22, 22, undefined, 'FAST');
        textStartX = margin + 28;
      } catch {
        // Segue sem logo se formato incompatível
      }
    }
  }

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(oficina?.nome || 'Minha Oficina', textStartX, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const oficinaLinhas: string[] = [];
  if (oficina?.cnpj_cpf) oficinaLinhas.push(`CPF/CNPJ: ${oficina.cnpj_cpf}`);
  if (oficina?.telefone || oficina?.email) {
    oficinaLinhas.push([oficina.telefone, oficina.email].filter(Boolean).join('  |  '));
  }
  if (oficina?.endereco) oficinaLinhas.push(oficina.endereco);
  oficinaLinhas.slice(0, 3).forEach((line, idx) => {
    doc.text(line, textStartX, 20 + idx * 4.5);
  });

  // Bloco direito: número e data
  doc.setTextColor(249, 115, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('ORÇAMENTO', pageWidth - margin, 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  const shortCode = orcamento.id.slice(0, 8).toUpperCase();
  const statusLabel = getStatusInfo(orcamento.status).label;
  doc.text(`Nº ${shortCode}`, pageWidth - margin, 19, { align: 'right' });
  doc.text(`Emissão: ${formatDateBR(orcamento.criado_em)}`, pageWidth - margin, 23.5, {
    align: 'right',
  });
  doc.text(`Validade: ${orcamento.validade_dias} dias`, pageWidth - margin, 28, {
    align: 'right',
  });
  doc.text(`Status: ${statusLabel}`, pageWidth - margin, 32.5, { align: 'right' });

  y = 47;

  // Dados do Cliente e Veículo (2 colunas)
  const colW = (contentWidth - 4) / 2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colW, 24, 2, 2, 'FD');
  doc.roundedRect(margin + colW + 4, y, colW, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(234, 88, 12);
  doc.text('CLIENTE', margin + 3, y + 5.5);
  doc.text('VEÍCULO', margin + colW + 7, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(cliente?.nome || 'Cliente não informado', margin + 3, y + 11);
  doc.text(
    `${veiculo?.marca || ''} ${veiculo?.modelo || 'Veículo'}`.trim(),
    margin + colW + 7,
    y + 11
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tel: ${cliente?.telefone || '-'}`, margin + 3, y + 16.5);
  doc.text(`E-mail: ${cliente?.email || '-'}`, margin + 3, y + 21);

  doc.text(
    `Placa: ${formatPlacaDisplay(veiculo?.placa)}   |   Ano: ${veiculo?.ano || '-'}`,
    margin + colW + 7,
    y + 16.5
  );
  doc.text(`Quilometragem: ${formatKm(veiculo?.km)}`, margin + colW + 7, y + 21);

  y += 30;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 16;
    }
  };

  // Cabeçalho da Tabela de Itens
  const drawTableHeader = () => {
    doc.setFillColor(30, 34, 43);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(248, 250, 252);
    doc.text('TIPO', margin + 2.5, y + 5.3);
    doc.text('DESCRIÇÃO / ÁREA', margin + 24, y + 5.3);
    doc.text('QTD', margin + 124, y + 5.3, { align: 'right' });
    doc.text('UNITÁRIO', margin + 152, y + 5.3, { align: 'right' });
    doc.text('TOTAL', pageWidth - margin - 2.5, y + 5.3, { align: 'right' });
    y += 8;
  };

  drawTableHeader();

  if (items.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum item lançado neste orçamento.', margin + 3, y + 7);
    y += 12;
  } else {
    items.forEach((item, index) => {
      const areaName = AREA_MAP[item.area_do_carro]?.nome || item.area_do_carro || 'Geral';
      const subtext = item.defeito ? `${areaName} · ${item.defeito}` : areaName;
      const descLines = doc.splitTextToSize(item.descricao || '-', 88) as string[];
      const rowHeight = Math.max(10, descLines.length * 4.2 + 5.5);

      ensureSpace(rowHeight + 4);
      if (y === 16) drawTableHeader();

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      if (item.tipo === 'peca') {
        doc.setTextColor(234, 88, 12);
        doc.text('PEÇA', margin + 2.5, y + 5);
      } else {
        doc.setTextColor(15, 118, 110);
        doc.text('M. OBRA', margin + 2.5, y + 5);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text(descLines, margin + 24, y + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(subtext, margin + 24, y + 4.8 + descLines.length * 4.1);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(String(item.quantidade), margin + 124, y + 5.2, { align: 'right' });
      doc.text(formatBRL(item.valor_unitario), margin + 152, y + 5.2, { align: 'right' });

      const lineTotal = (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0);
      doc.setFont('helvetica', 'bold');
      doc.text(formatBRL(lineTotal), pageWidth - margin - 2.5, y + 5.2, { align: 'right' });

      y += rowHeight;
    });
  }

  y += 6;
  ensureSpace(40);

  // Totais
  const totals = calcQuoteTotals(items, orcamento.desconto);
  const summaryW = 78;
  const summaryX = pageWidth - margin - summaryW;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, y, summaryW, totals.desconto > 0 ? 31 : 25, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal Peças:', summaryX + 4, y + 6);
  doc.text(formatBRL(totals.subtotalPecas), pageWidth - margin - 4, y + 6, { align: 'right' });

  doc.text('Subtotal Mão de Obra:', summaryX + 4, y + 11.5);
  doc.text(formatBRL(totals.subtotalMaoDeObra), pageWidth - margin - 4, y + 11.5, {
    align: 'right',
  });

  let totalY = y + 19;
  if (totals.desconto > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text('Desconto:', summaryX + 4, y + 17);
    doc.text(`- ${formatBRL(totals.desconto)}`, pageWidth - margin - 4, y + 17, {
      align: 'right',
    });
    totalY = y + 25;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX + 3, totalY - 4.5, pageWidth - margin - 3, totalY - 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL:', summaryX + 4, totalY);
  doc.setTextColor(234, 88, 12);
  doc.text(formatBRL(totals.total), pageWidth - margin - 4, totalY, { align: 'right' });

  // Observações no lado esquerdo ou abaixo
  if (orcamento.observacoes && orcamento.observacoes.trim()) {
    const obsWidth = contentWidth - summaryW - 6;
    const obsLines = doc.splitTextToSize(orcamento.observacoes.trim(), obsWidth - 6) as string[];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(234, 88, 12);
    doc.text('OBSERVAÇÕES', margin, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    doc.text(obsLines, margin, y + 10);
  }

  // Rodapé
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Orçamento válido por ${orcamento.validade_dias} dias a partir de ${formatDateBR(orcamento.criado_em)}. Valores sujeitos a confirmação de estoque.`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  const placaSlug = formatPlacaDisplay(veiculo?.placa).replace(/[^A-Z0-9]/gi, '') || 'veiculo';
  const fileName = `orcamento-${placaSlug}-${shortCode}.pdf`;
  const blob = doc.output('blob');
  return { blob, fileName };
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
