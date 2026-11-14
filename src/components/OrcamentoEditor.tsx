import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Share2,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { AREA_MAP, CAR_AREAS, STATUS_OPTIONS } from '../data/checklistData';
import {
  buildClientEmailMailtoUrl,
  buildClientQuoteWhatsAppUrl,
  buildSupplierQuoteWhatsAppUrl,
  calcQuoteTotals,
  formatBRL,
  formatKm,
  formatPlacaDisplay,
  normalizePlaca,
} from '../lib/formatters';
import { generateQuotePdfBlob, triggerBlobDownload } from '../lib/pdfGenerator';
import { formatSupabaseError, supabase } from '../lib/supabase';
import type {
  AreaId,
  Cliente,
  Fornecedor,
  ItemTipo,
  Oficina,
  Orcamento,
  OrcamentoItem,
  OrcamentoStatus,
  ServicoPadrao,
  Veiculo,
} from '../types';
import { CarChecklistSvg } from './CarChecklistSvg';
import { ConfirmModal } from './ConfirmModal';

interface OrcamentoEditorProps {
  userId: string;
  oficina: Oficina | null;
  clientes: Cliente[];
  veiculos: Veiculo[];
  fornecedores: Fornecedor[];
  servicosPadrao: ServicoPadrao[];
  initialOrcamento: Orcamento | null;
  preselectedClienteId?: string;
  preselectedVeiculoId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const AREA_OBS_MARKER = '--- OBSERVAÇÕES DA INSPEÇÃO ---';

function parseObservacoes(raw: string): {
  generalObs: string;
  areaNotes: Record<string, string>;
} {
  if (!raw) return { generalObs: '', areaNotes: {} };
  const idx = raw.indexOf(AREA_OBS_MARKER);
  if (idx === -1) return { generalObs: raw.trim(), areaNotes: {} };

  const generalObs = raw.slice(0, idx).trim();
  const rest = raw.slice(idx + AREA_OBS_MARKER.length).trim();
  const areaNotes: Record<string, string> = {};

  rest.split('\n').forEach((line) => {
    const match = line.match(/^\[([a-z_]+)\]\s*(.+)$/);
    if (match) {
      areaNotes[match[1]] = match[2].trim();
    }
  });
  return { generalObs, areaNotes };
}

function serializeObservacoes(
  generalObs: string,
  areaNotes: Record<string, string>
): string {
  const noteLines = Object.entries(areaNotes)
    .filter(([, text]) => text.trim().length > 0)
    .map(([areaId, text]) => `[${areaId}] ${text.trim()}`);

  const cleanGeneral = generalObs.trim();
  if (noteLines.length === 0) return cleanGeneral;
  if (!cleanGeneral) return `${AREA_OBS_MARKER}\n${noteLines.join('\n')}`;
  return `${cleanGeneral}\n\n${AREA_OBS_MARKER}\n${noteLines.join('\n')}`;
}

export const OrcamentoEditor: React.FC<OrcamentoEditorProps> = ({
  userId,
  oficina,
  clientes,
  veiculos,
  fornecedores,
  servicosPadrao,
  initialOrcamento,
  preselectedClienteId,
  preselectedVeiculoId,
  onClose,
  onSaved,
}) => {
  const parsed = useMemo(
    () => parseObservacoes(initialOrcamento?.observacoes || ''),
    [initialOrcamento]
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialOrcamento ? 2 : 1);
  const [orcamentoId, setOrcamentoId] = useState<string | null>(initialOrcamento?.id || null);

  // Passo 1: Cliente e Veículo
  const [clienteId, setClienteId] = useState(
    initialOrcamento?.cliente_id || preselectedClienteId || ''
  );
  const [veiculoId, setVeiculoId] = useState(
    initialOrcamento?.veiculo_id || preselectedVeiculoId || ''
  );
  const [clientSearch, setClientSearch] = useState('');
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [qcNome, setQcNome] = useState('');
  const [qcTel, setQcTel] = useState('');
  const [qcEmail, setQcEmail] = useState('');

  const [quickVehicleOpen, setQuickVehicleOpen] = useState(false);
  const [qvPlaca, setQvPlaca] = useState('');
  const [qvMarca, setQvMarca] = useState('');
  const [qvModelo, setQvModelo] = useState('');
  const [qvAno, setQvAno] = useState(String(new Date().getFullYear()));
  const [qvKm, setQvKm] = useState('');

  // Passo 2 & 3: Itens & Notas
  const [items, setItems] = useState<OrcamentoItem[]>(
    initialOrcamento?.orcamento_itens || []
  );
  const [areaNotes, setAreaNotes] = useState<Record<string, string>>(parsed.areaNotes);
  const [activeArea, setActiveArea] = useState<AreaId | null>(null);

  // Passo 4: Resumo & Status
  const [status, setStatus] = useState<OrcamentoStatus>(
    initialOrcamento?.status || 'rascunho'
  );
  const [desconto, setDesconto] = useState(String(initialOrcamento?.desconto ?? 0));
  const [validadeDias, setValidadeDias] = useState(
    String(initialOrcamento?.validade_dias ?? 7)
  );
  const [generalObs, setGeneralObs] = useState(parsed.generalObs);

  // Modais de Itens & Cotação
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [mTipo, setMTipo] = useState<ItemTipo>('peca');
  const [mArea, setMArea] = useState<string>('geral');
  const [mDesc, setMDesc] = useState('');
  const [mQtd, setMQtd] = useState('1');
  const [mValor, setMValor] = useState('');

  const [stdPickerOpen, setStdPickerOpen] = useState(false);
  const [quoteSupplierItem, setQuoteSupplierItem] = useState<OrcamentoItem | null>(null);
  const [customSupplierPhone, setCustomSupplierPhone] = useState('');
  const [deleteItemTarget, setDeleteItemTarget] = useState<OrcamentoItem | null>(null);

  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === clienteId) || initialOrcamento?.clientes || null,
    [clientes, clienteId, initialOrcamento]
  );

  const selectedVeiculo = useMemo(
    () => veiculos.find((v) => v.id === veiculoId) || initialOrcamento?.veiculos || null,
    [veiculos, veiculoId, initialOrcamento]
  );

  const clientVehicles = useMemo(
    () => veiculos.filter((v) => v.cliente_id === clienteId),
    [veiculos, clienteId]
  );

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      const cars = veiculos.filter((v) => v.cliente_id === c.id);
      const carMatch = cars.some(
        (v) =>
          v.placa.toLowerCase().includes(q) ||
          formatPlacaDisplay(v.placa).toLowerCase().includes(q) ||
          v.modelo.toLowerCase().includes(q)
      );
      return (
        c.nome.toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        carMatch
      );
    });
  }, [clientes, veiculos, clientSearch]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Garante que o orçamento existe no banco antes de salvar itens
  const ensureOrcamentoSaved = async (): Promise<string> => {
    if (!supabase) throw new Error('Supabase não configurado.');
    if (!clienteId || !veiculoId) {
      throw new Error('Escolha um cliente e um veículo antes de continuar.');
    }

    const obsFinal = serializeObservacoes(generalObs, areaNotes);
    const payload = {
      user_id: userId,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      status,
      desconto: Math.max(0, Number(desconto.replace(',', '.')) || 0),
      validade_dias: Math.max(1, Number(validadeDias) || 7),
      observacoes: obsFinal,
    };

    if (orcamentoId) {
      const { error } = await supabase
        .from('orcamentos')
        .update(payload)
        .eq('id', orcamentoId)
        .eq('user_id', userId);
      if (error) throw error;
      return orcamentoId;
    }

    const { data, error } = await supabase
      .from('orcamentos')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    setOrcamentoId(data.id);
    await onSaved();
    return data.id;
  };

  const handleQuickCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !qcNome.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          user_id: userId,
          nome: qcNome.trim(),
          telefone: qcTel.trim(),
          email: qcEmail.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      await onSaved();
      setClienteId(data.id);
      setVeiculoId('');
      setQuickClientOpen(false);
      setQuickVehicleOpen(true);
      setQcNome('');
      setQcTel('');
      setQcEmail('');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !clienteId) return;
    const cleanPlaca = normalizePlaca(qvPlaca);
    if (cleanPlaca.length < 7 || !qvModelo.trim()) {
      setErrorMsg('Informe a placa (7 caracteres) e o modelo do veículo.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('veiculos')
        .insert({
          user_id: userId,
          cliente_id: clienteId,
          placa: cleanPlaca,
          marca: qvMarca.trim(),
          modelo: qvModelo.trim(),
          ano: Number(qvAno) || new Date().getFullYear(),
          km: Number(qvKm) || 0,
        })
        .select()
        .single();
      if (error) throw error;
      await onSaved();
      setVeiculoId(data.id);
      setQuickVehicleOpen(false);
      setQvPlaca('');
      setQvMarca('');
      setQvModelo('');
      setQvKm('');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStepChange = async (targetStep: 1 | 2 | 3 | 4) => {
    setErrorMsg(null);
    if (targetStep > 1) {
      if (!clienteId || !veiculoId) {
        setErrorMsg('Selecione ou cadastre o cliente e o veículo primeiro.');
        return;
      }
      setSaving(true);
      try {
        await ensureOrcamentoSaved();
        setStep(targetStep);
      } catch (err) {
        setErrorMsg(formatSupabaseError(err));
      } finally {
        setSaving(false);
      }
    } else {
      setStep(1);
    }
  };

  // Contagem de defeitos marcados por área
  const defectsByArea = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    items.forEach((it) => {
      if (it.area_do_carro && it.defeito) {
        if (!map[it.area_do_carro]) map[it.area_do_carro] = new Set();
        map[it.area_do_carro].add(it.defeito);
      }
    });
    return map;
  }, [items]);

  const selectedCounts = useMemo(() => {
    const res: Record<string, number> = {};
    Object.entries(defectsByArea).forEach(([areaId, set]) => {
      res[areaId] = set.size;
    });
    return res;
  }, [defectsByArea]);

  // Marca / desmarca defeito comum no checklist visual
  const handleToggleDefect = async (areaId: AreaId, defeito: string) => {
    if (!supabase) return;
    setErrorMsg(null);
    const alreadyChecked = defectsByArea[areaId]?.has(defeito) || false;

    try {
      const id = await ensureOrcamentoSaved();

      if (alreadyChecked) {
        const toRemove = items.filter(
          (it) => it.area_do_carro === areaId && it.defeito === defeito
        );
        const ids = toRemove.map((i) => i.id);
        if (ids.length > 0) {
          const { error } = await supabase.from('orcamento_itens').delete().in('id', ids);
          if (error) throw error;
          setItems((prev) => prev.filter((it) => !ids.includes(it.id)));
        }
      } else {
        // Cria item de Peça + item de Mão de obra para o mecânico preencher valores
        const newRows = [
          {
            orcamento_id: id,
            area_do_carro: areaId,
            defeito,
            descricao: `${defeito} (Peça)`,
            tipo: 'peca' as ItemTipo,
            quantidade: 1,
            valor_unitario: 0,
          },
          {
            orcamento_id: id,
            area_do_carro: areaId,
            defeito,
            descricao: `Mão de obra: ${defeito}`,
            tipo: 'mao_de_obra' as ItemTipo,
            quantidade: 1,
            valor_unitario: 0,
          },
        ];
        const { data, error } = await supabase
          .from('orcamento_itens')
          .insert(newRows)
          .select();
        if (error) throw error;
        setItems((prev) => [...prev, ...(data as OrcamentoItem[])]);
      }
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    }
  };

  const handleSaveAreaNote = async () => {
    try {
      await ensureOrcamentoSaved();
      setActiveArea(null);
      showToast('Checklist da área salvo.');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    }
  };

  // Atualiza item localmente e no Supabase
  const updateItemLocal = (id: string, patch: Partial<OrcamentoItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const persistItemPatch = async (id: string, patch: Partial<OrcamentoItem>) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('orcamento_itens').update(patch).eq('id', id);
      if (error) throw error;
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    }
  };

  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !mDesc.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const id = await ensureOrcamentoSaved();
      const { data, error } = await supabase
        .from('orcamento_itens')
        .insert({
          orcamento_id: id,
          area_do_carro: mArea,
          defeito: '',
          descricao: mDesc.trim(),
          tipo: mTipo,
          quantidade: Math.max(0.1, Number(mQtd.replace(',', '.')) || 1),
          valor_unitario: Math.max(0, Number(mValor.replace(',', '.')) || 0),
        })
        .select()
        .single();
      if (error) throw error;
      setItems((prev) => [...prev, data as OrcamentoItem]);
      setManualModalOpen(false);
      setMDesc('');
      setMQtd('1');
      setMValor('');
      showToast('Item adicionado ao orçamento.');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddStandardService = async (srv: ServicoPadrao) => {
    if (!supabase) return;
    setErrorMsg(null);
    try {
      const id = await ensureOrcamentoSaved();
      const { data, error } = await supabase
        .from('orcamento_itens')
        .insert({
          orcamento_id: id,
          area_do_carro: 'geral',
          defeito: 'Serviço padrão',
          descricao: srv.nome,
          tipo: 'mao_de_obra',
          quantidade: 1,
          valor_unitario: srv.valor,
        })
        .select()
        .single();
      if (error) throw error;
      setItems((prev) => [...prev, data as OrcamentoItem]);
      setStdPickerOpen(false);
      showToast(`"${srv.nome}" adicionado!`);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    }
  };

  const handleDeleteItem = async () => {
    if (!supabase || !deleteItemTarget) return;
    try {
      const { error } = await supabase
        .from('orcamento_itens')
        .delete()
        .eq('id', deleteItemTarget.id);
      if (error) throw error;
      setItems((prev) => prev.filter((it) => it.id !== deleteItemTarget.id));
      setDeleteItemTarget(null);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
      setDeleteItemTarget(null);
    }
  };

  const handleSaveSummary = async (nextStatus?: OrcamentoStatus) => {
    if (!supabase) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const st = nextStatus || status;
      if (nextStatus) setStatus(nextStatus);
      const id = await ensureOrcamentoSaved();
      const { error } = await supabase
        .from('orcamentos')
        .update({
          status: st,
          desconto: Math.max(0, Number(desconto.replace(',', '.')) || 0),
          validade_dias: Math.max(1, Number(validadeDias) || 7),
          observacoes: serializeObservacoes(generalObs, areaNotes),
        })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      await onSaved();
      showToast('Orçamento salvo com sucesso!');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const buildCurrentOrcamentoSnapshot = (): Orcamento => ({
    id: orcamentoId || 'novo',
    user_id: userId,
    cliente_id: clienteId,
    veiculo_id: veiculoId,
    status,
    desconto: Math.max(0, Number(desconto.replace(',', '.')) || 0),
    validade_dias: Math.max(1, Number(validadeDias) || 7),
    observacoes: serializeObservacoes(generalObs, areaNotes),
    criado_em: initialOrcamento?.criado_em || new Date().toISOString(),
  });

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    setErrorMsg(null);
    try {
      await handleSaveSummary();
      const { blob, fileName } = await generateQuotePdfBlob({
        oficina,
        cliente: selectedCliente,
        veiculo: selectedVeiculo,
        orcamento: buildCurrentOrcamentoSnapshot(),
        items,
      });
      triggerBlobDownload(blob, fileName);
      showToast(`PDF "${fileName}" gerado e baixado!`);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setPdfBusy(false);
    }
  };

  const handleSharePdfNative = async () => {
    setPdfBusy(true);
    setErrorMsg(null);
    try {
      await handleSaveSummary();
      const { blob, fileName } = await generateQuotePdfBlob({
        oficina,
        cliente: selectedCliente,
        veiculo: selectedVeiculo,
        orcamento: buildCurrentOrcamentoSnapshot(),
        items,
      });
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Orçamento ${formatPlacaDisplay(selectedVeiculo?.placa)}`,
          text: `Orçamento da ${oficina?.nome || 'OficinaPro'}`,
          files: [file],
        });
      } else {
        triggerBlobDownload(blob, fileName);
        showToast('PDF baixado no aparelho.');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setErrorMsg(formatSupabaseError(err));
      }
    } finally {
      setPdfBusy(false);
    }
  };

  const handleEmailSend = async () => {
    setPdfBusy(true);
    setErrorMsg(null);
    try {
      await handleSaveSummary();
      const snapshot = buildCurrentOrcamentoSnapshot();
      const { blob, fileName } = await generateQuotePdfBlob({
        oficina,
        cliente: selectedCliente,
        veiculo: selectedVeiculo,
        orcamento: snapshot,
        items,
      });
      triggerBlobDownload(blob, fileName);
      showToast('PDF baixado! Anexe o arquivo no e-mail que está abrindo.');

      const mailUrl = buildClientEmailMailtoUrl({
        cliente: selectedCliente,
        veiculo: selectedVeiculo,
        oficina,
        orcamento: snapshot,
        items,
      });
      const link = document.createElement('a');
      link.href = mailUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setPdfBusy(false);
    }
  };

  const totals = useMemo(
    () => calcQuoteTotals(items, Number(desconto.replace(',', '.')) || 0),
    [items, desconto]
  );

  const clientWhatsAppUrl = useMemo(() => {
    if (!selectedCliente?.telefone) return null;
    return buildClientQuoteWhatsAppUrl({
      cliente: selectedCliente,
      veiculo: selectedVeiculo,
      oficina,
      orcamento: buildCurrentOrcamentoSnapshot(),
      items,
    });
  }, [selectedCliente, selectedVeiculo, oficina, status, desconto, validadeDias, generalObs, areaNotes, items]);

  const activeAreaDef = activeArea ? AREA_MAP[activeArea] : null;

  return (
    <div className="space-y-5 pb-8">
      {/* Barra Superior do Editor */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[46px] inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-[#181c23] px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4 text-orange-400" />
          <span>Voltar</span>
        </button>

        <div className="min-w-0 text-right">
          <p className="text-sm font-bold text-white truncate">
            {selectedVeiculo
              ? `${formatPlacaDisplay(selectedVeiculo.placa)} · ${selectedVeiculo.modelo}`
              : 'Novo Orçamento'}
          </p>
          <p className="font-mono-num text-xs font-bold text-orange-400">
            Total: {formatBRL(totals.total)}
          </p>
        </div>
      </div>

      {/* Passos do Fluxo */}
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-800 bg-[#181c23] p-1.5">
        {[
          { num: 1 as const, label: '1. Carro' },
          { num: 2 as const, label: '2. Checklist' },
          { num: 3 as const, label: '3. Itens' },
          { num: 4 as const, label: '4. PDF/Envio' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            disabled={saving}
            onClick={() => handleStepChange(s.num)}
            className={`min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap px-1 ${
              step === s.num
                ? 'bg-orange-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {toastMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3.5 text-sm font-semibold text-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* PASSO 1: CLIENTE E VEÍCULO */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-white">Escolha o Cliente</h3>
              <button
                type="button"
                onClick={() => setQuickClientOpen((v) => !v)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 text-xs font-bold text-orange-400 hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" />
                <span>Novo Cliente</span>
              </button>
            </div>

            {quickClientOpen && (
              <form
                onSubmit={handleQuickCreateClient}
                className="rounded-xl border border-orange-500/40 bg-[#0f1115] p-4 space-y-3"
              >
                <p className="text-xs font-bold text-orange-400">Cadastro rápido de cliente</p>
                <input
                  type="text"
                  required
                  value={qcNome}
                  onChange={(e) => setQcNome(e.target.value)}
                  placeholder="Nome do cliente *"
                  className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base text-white focus:border-orange-500 focus:outline-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="tel"
                    value={qcTel}
                    onChange={(e) => setQcTel(e.target.value)}
                    placeholder="WhatsApp / Telefone"
                    className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base text-white focus:border-orange-500 focus:outline-none"
                  />
                  <input
                    type="email"
                    value={qcEmail}
                    onChange={(e) => setQcEmail(e.target.value)}
                    placeholder="E-mail (opcional)"
                    className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickClientOpen(false)}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 min-h-[44px] rounded-xl bg-orange-500 text-sm font-bold text-slate-950"
                  >
                    Salvar Cliente
                  </button>
                </div>
              </form>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Filtrar cliente por nome, telefone ou placa..."
                className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#0f1115] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {filteredClients.map((c) => {
                const selected = c.id === clienteId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClienteId(c.id);
                      const cars = veiculos.filter((v) => v.cliente_id === c.id);
                      setVeiculoId(cars[0]?.id || '');
                    }}
                    className={`min-h-[58px] rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-orange-500 bg-orange-500/15'
                        : 'border-slate-800 bg-[#0f1115] hover:border-slate-700'
                    }`}
                  >
                    <p className="text-sm font-bold text-white truncate">{c.nome}</p>
                    <p className="text-xs text-slate-400 font-mono-num truncate">
                      {c.telefone || 'Sem telefone'}
                    </p>
                  </button>
                );
              })}
              {filteredClients.length === 0 && (
                <p className="text-sm text-slate-400 col-span-full py-3 text-center">
                  Nenhum cliente encontrado. Toque em "+ Novo Cliente".
                </p>
              )}
            </div>
          </div>

          {clienteId && (
            <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-white">Escolha o Veículo</h3>
                <button
                  type="button"
                  onClick={() => setQuickVehicleOpen((v) => !v)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 text-xs font-bold text-orange-400 hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>Novo Veículo</span>
                </button>
              </div>

              {quickVehicleOpen && (
                <form
                  onSubmit={handleQuickCreateVehicle}
                  className="rounded-xl border border-orange-500/40 bg-[#0f1115] p-4 space-y-3"
                >
                  <p className="text-xs font-bold text-orange-400">Cadastro rápido de veículo</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={qvPlaca}
                      onChange={(e) => setQvPlaca(normalizePlaca(e.target.value))}
                      placeholder="Placa (ABC1D23) *"
                      className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base font-mono-num uppercase text-orange-300 focus:border-orange-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={qvMarca}
                      onChange={(e) => setQvMarca(e.target.value)}
                      placeholder="Marca (ex.: Fiat)"
                      className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={qvModelo}
                    onChange={(e) => setQvModelo(e.target.value)}
                    placeholder="Modelo (ex.: Argo 1.3) *"
                    className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base text-white focus:border-orange-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      value={qvAno}
                      onChange={(e) => setQvAno(e.target.value)}
                      placeholder="Ano"
                      className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={qvKm}
                      onChange={(e) => setQvKm(e.target.value)}
                      placeholder="KM atual"
                      className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#181c23] px-3.5 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickVehicleOpen(false)}
                      className="min-h-[44px] px-4 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 min-h-[44px] rounded-xl bg-orange-500 text-sm font-bold text-slate-950"
                    >
                      Salvar Veículo
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {clientVehicles.map((v) => {
                  const selected = v.id === veiculoId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVeiculoId(v.id)}
                      className={`min-h-[64px] rounded-xl border p-3.5 text-left transition ${
                        selected
                          ? 'border-orange-500 bg-orange-500/15'
                          : 'border-slate-800 bg-[#0f1115] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-num text-base font-bold text-orange-400">
                          {formatPlacaDisplay(v.placa)}
                        </span>
                        <span className="font-mono-num text-xs text-slate-400">
                          {v.ano} · {formatKm(v.km)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-white truncate">
                        {v.marca} {v.modelo}
                      </p>
                    </button>
                  );
                })}
                {clientVehicles.length === 0 && !quickVehicleOpen && (
                  <p className="text-sm text-slate-400 col-span-full py-2">
                    Este cliente ainda não possui veículo. Toque em "+ Novo Veículo".
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!clienteId || !veiculoId || saving}
            onClick={() => handleStepChange(2)}
            className="w-full min-h-[56px] rounded-2xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition disabled:opacity-40"
          >
            {saving ? 'Salvando...' : 'Ir para Checklist Visual do Carro'}
          </button>
        </div>
      )}

      {/* PASSO 2: CHECKLIST VISUAL */}
      {step === 2 && (
        <div className="space-y-5">
          <CarChecklistSvg
            selectedCounts={selectedCounts}
            notesByArea={areaNotes}
            onSelectArea={(id) => setActiveArea(id)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleStepChange(3)}
              className="w-full min-h-[56px] rounded-2xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition sm:order-2"
            >
              Ir para Peças e Mão de Obra ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full min-h-[52px] rounded-2xl border border-slate-700 bg-[#181c23] text-sm font-semibold text-slate-200 hover:bg-slate-800 sm:order-1"
            >
              Alterar Cliente / Veículo
            </button>
          </div>
        </div>
      )}

      {/* PASSO 3: ITENS (PEÇAS, MÃO DE OBRA, COTAÇÃO WHATSAPP) */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setMTipo('peca');
                setMArea('geral');
                setMDesc('');
                setMQtd('1');
                setMValor('');
                setManualModalOpen(true);
              }}
              className="min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/50 bg-orange-500/10 px-4 text-sm font-bold text-orange-300 hover:bg-orange-500/20"
            >
              <Plus className="h-5 w-5" />
              <span>Adicionar Item Manual</span>
            </button>

            <button
              type="button"
              onClick={() => setStdPickerOpen(true)}
              className="min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#181c23] px-4 text-sm font-bold text-slate-100 hover:bg-slate-800"
            >
              <Wrench className="h-5 w-5 text-orange-400" />
              <span>Adicionar Serviço Padrão</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-8 text-center">
              <p className="text-base font-semibold text-slate-200">
                Nenhum item lançado ainda
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Marque defeitos no Checklist Visual ou adicione itens manuais e serviços padrão acima.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const areaName = AREA_MAP[item.area_do_carro]?.nome || 'Geral';
                const lineTotal =
                  (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-800 bg-[#181c23] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`font-bold ${
                              item.tipo === 'peca' ? 'text-orange-400' : 'text-teal-400'
                            }`}
                          >
                            {item.tipo === 'peca' ? 'Peça' : 'Mão de obra'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">{areaName}</span>
                          {item.defeito && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-400 truncate">{item.defeito}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeleteItemTarget(item)}
                        aria-label="Excluir item"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-red-500/15 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={item.descricao}
                      onChange={(e) => updateItemLocal(item.id, { descricao: e.target.value })}
                      onBlur={(e) => persistItemPatch(item.id, { descricao: e.target.value })}
                      placeholder="Nome da peça ou descrição do serviço"
                      className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#0f1115] px-3.5 text-base font-semibold text-white focus:border-orange-500 focus:outline-none"
                    />

                    <div className="grid grid-cols-12 gap-2.5 items-end">
                      <div className="col-span-4 sm:col-span-3">
                        <label className="block text-xs text-slate-400 mb-1">Qtd</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={item.quantidade}
                          onChange={(e) =>
                            updateItemLocal(item.id, { quantidade: Number(e.target.value) || 0 })
                          }
                          onBlur={(e) =>
                            persistItemPatch(item.id, {
                              quantidade: Math.max(0.1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#0f1115] px-3 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-4">
                        <label className="block text-xs text-slate-400 mb-1">Valor Unit. (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valor_unitario}
                          onChange={(e) =>
                            updateItemLocal(item.id, {
                              valor_unitario: Number(e.target.value) || 0,
                            })
                          }
                          onBlur={(e) =>
                            persistItemPatch(item.id, {
                              valor_unitario: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#0f1115] px-3 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-5 text-right pb-2.5">
                        <p className="text-[11px] text-slate-400">Subtotal</p>
                        <p className="font-mono-num text-base font-bold text-white">
                          {formatBRL(lineTotal)}
                        </p>
                      </div>
                    </div>

                    {item.tipo === 'peca' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomSupplierPhone('');
                          setQuoteSupplierItem(item);
                        }}
                        className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20 active:scale-[0.98] transition"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Pedir cotação desta peça no WhatsApp</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Barra Resumo Rápido */}
          <div className="rounded-2xl border border-slate-800 bg-[#141820] p-4 flex items-center justify-between gap-4">
            <div className="text-xs text-slate-400 space-y-0.5 font-mono-num">
              <p>Peças: {formatBRL(totals.subtotalPecas)}</p>
              <p>Mão de obra: {formatBRL(totals.subtotalMaoDeObra)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Total parcial</p>
              <p className="font-mono-num text-xl font-bold text-orange-400">
                {formatBRL(totals.total)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleStepChange(4)}
            className="w-full min-h-[56px] rounded-2xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition"
          >
            Ir para Resumo, PDF e Envio
          </button>
        </div>
      )}

      {/* PASSO 4: RESUMO, STATUS, PDF E ENVIO */}
      {step === 4 && (
        <div className="space-y-5">
          {/* Status */}
          <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-4 sm:p-5 space-y-3">
            <h3 className="text-base font-bold text-white">Status do Orçamento</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STATUS_OPTIONS.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => handleSaveSummary(st.value)}
                  className={`min-h-[48px] rounded-xl px-3 text-sm font-bold transition ${
                    status === st.value
                      ? 'bg-orange-500 text-slate-950'
                      : 'border border-slate-700 bg-[#0f1115] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desconto, Validade e Observações */}
          <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Desconto (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Validade (dias)
                </label>
                <input
                  type="number"
                  min="1"
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(e.target.value)}
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Observações gerais para o cliente
              </label>
              <textarea
                rows={3}
                value={generalObs}
                onChange={(e) => setGeneralObs(e.target.value)}
                placeholder="Garantia de 90 dias nos serviços executados, prazo de entrega..."
                className="w-full rounded-xl border border-slate-700 bg-[#0f1115] p-3.5 text-base text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveSummary()}
              className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-slate-800 text-sm font-bold text-white hover:bg-slate-700"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>

          {/* Card de Totais */}
          <div className="rounded-2xl border border-orange-500/30 bg-[#181c23] p-5 space-y-2.5">
            <div className="flex justify-between text-sm text-slate-300">
              <span>Subtotal Peças</span>
              <span className="font-mono-num font-semibold">{formatBRL(totals.subtotalPecas)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-300">
              <span>Subtotal Mão de Obra</span>
              <span className="font-mono-num font-semibold">
                {formatBRL(totals.subtotalMaoDeObra)}
              </span>
            </div>
            {totals.desconto > 0 && (
              <div className="flex justify-between text-sm text-red-400">
                <span>Desconto</span>
                <span className="font-mono-num font-semibold">- {formatBRL(totals.desconto)}</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-3 flex justify-between items-baseline">
              <span className="text-base font-bold text-white">Total do Orçamento</span>
              <span className="font-mono-num text-2xl font-bold text-orange-400">
                {formatBRL(totals.total)}
              </span>
            </div>
          </div>

          {/* Botões de PDF e Envio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={pdfBusy}
              onClick={handleDownloadPdf}
              className="min-h-[56px] inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-base font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition disabled:opacity-50"
            >
              <Download className="h-5 w-5" />
              <span>{pdfBusy ? 'Gerando PDF...' : 'Baixar PDF'}</span>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                disabled={pdfBusy}
                onClick={handleSharePdfNative}
                className="min-h-[56px] inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500/50 bg-orange-500/15 px-5 text-base font-bold text-orange-300 hover:bg-orange-500/25 active:scale-[0.98] transition disabled:opacity-50"
              >
                <Share2 className="h-5 w-5" />
                <span>Compartilhar PDF</span>
              </button>
            )}

            {clientWhatsAppUrl ? (
              <a
                href={clientWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[56px] inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-base font-bold text-white hover:bg-emerald-500 active:scale-[0.98] transition"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Enviar por WhatsApp</span>
              </a>
            ) : (
              <div className="min-h-[56px] flex items-center justify-center rounded-2xl border border-slate-800 bg-[#141820] px-4 text-xs text-slate-400 text-center">
                Cadastre o telefone do cliente para enviar por WhatsApp
              </div>
            )}

            <button
              type="button"
              disabled={pdfBusy}
              onClick={handleEmailSend}
              className="min-h-[56px] inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-[#181c23] px-5 text-base font-bold text-slate-100 hover:bg-slate-800 active:scale-[0.98] transition disabled:opacity-50"
            >
              <Mail className="h-5 w-5 text-orange-400" />
              <span>Enviar por E-mail</span>
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET / MODAL DA ÁREA DO CHECKLIST */}
      {activeAreaDef && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-2xl border border-slate-700 bg-[#181c23] shadow-2xl">
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 sm:hidden" />

            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-white">{activeAreaDef.nome}</h3>
                <p className="text-xs text-slate-400">{activeAreaDef.resumo}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveArea(null)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
              {activeAreaDef.defeitosComuns.map((defeito) => {
                const checked = defectsByArea[activeAreaDef.id]?.has(defeito) || false;
                return (
                  <button
                    key={defeito}
                    type="button"
                    onClick={() => handleToggleDefect(activeAreaDef.id, defeito)}
                    className={`w-full min-h-[54px] rounded-xl border px-4 py-3 text-left flex items-center justify-between gap-3 transition active:scale-[0.99] ${
                      checked
                        ? 'border-orange-500 bg-orange-500/15 text-white'
                        : 'border-slate-800 bg-[#0f1115] text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-sm sm:text-base font-medium">{defeito}</span>
                    <div
                      className={`h-7 w-7 shrink-0 rounded-lg border flex items-center justify-center ${
                        checked
                          ? 'border-orange-500 bg-orange-500 text-slate-950'
                          : 'border-slate-600 bg-transparent'
                      }`}
                    >
                      {checked && <Check className="h-4 w-4 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}

              <div className="pt-3">
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Observação livre ({activeAreaDef.nome})
                </label>
                <textarea
                  rows={2}
                  value={areaNotes[activeAreaDef.id] || ''}
                  onChange={(e) =>
                    setAreaNotes((prev) => ({
                      ...prev,
                      [activeAreaDef.id]: e.target.value,
                    }))
                  }
                  placeholder={`Ex.: detalhes encontrados em ${activeAreaDef.nome.toLowerCase()}...`}
                  className="w-full rounded-xl border border-slate-700 bg-[#0f1115] p-3.5 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-800 p-4">
              <button
                type="button"
                onClick={handleSaveAreaNote}
                className="w-full min-h-[52px] rounded-xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400"
              >
                Concluir {activeAreaDef.nome}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ITEM MANUAL */}
      {manualModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#181c23] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-white">Adicionar Item Manual</h3>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMTipo('peca')}
                  className={`min-h-[48px] rounded-xl text-sm font-bold ${
                    mTipo === 'peca'
                      ? 'bg-orange-500 text-slate-950'
                      : 'border border-slate-700 bg-[#0f1115] text-slate-300'
                  }`}
                >
                  Peça
                </button>
                <button
                  type="button"
                  onClick={() => setMTipo('mao_de_obra')}
                  className={`min-h-[48px] rounded-xl text-sm font-bold ${
                    mTipo === 'mao_de_obra'
                      ? 'bg-orange-500 text-slate-950'
                      : 'border border-slate-700 bg-[#0f1115] text-slate-300'
                  }`}
                >
                  Mão de obra
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Área do carro
                </label>
                <select
                  value={mArea}
                  onChange={(e) => setMArea(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#0f1115] px-3.5 text-base text-white focus:border-orange-500 focus:outline-none"
                >
                  <option value="geral">Geral</option>
                  {CAR_AREAS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Descrição *
                </label>
                <input
                  type="text"
                  required
                  value={mDesc}
                  onChange={(e) => setMDesc(e.target.value)}
                  placeholder={mTipo === 'peca' ? 'Ex.: Jogo de pastilhas Cobreq' : 'Ex.: Troca de pastilhas'}
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={mQtd}
                    onChange={(e) => setMQtd(e.target.value)}
                    className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                    Valor Unit. (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={mValor}
                    onChange={(e) => setMValor(e.target.value)}
                    placeholder="0.00"
                    className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[52px] rounded-xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400"
              >
                {saving ? 'Adicionando...' : 'Adicionar ao Orçamento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SERVIÇO PADRÃO */}
      {stdPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-slate-700 bg-[#181c23] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <h3 className="text-lg font-bold text-white">Escolher Serviço Padrão</h3>
              <button
                type="button"
                onClick={() => setStdPickerOpen(false)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {servicosPadrao.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  <FileText className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                  Você ainda não cadastrou serviços padrão na aba "Serviços".
                </div>
              ) : (
                servicosPadrao.map((srv) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => handleAddStandardService(srv)}
                    className="w-full min-h-[58px] rounded-xl border border-slate-800 bg-[#0f1115] px-4 py-3 flex items-center justify-between gap-3 hover:border-orange-500 transition text-left"
                  >
                    <span className="text-sm font-bold text-white">{srv.nome}</span>
                    <span className="font-mono-num text-sm font-bold text-orange-400 shrink-0">
                      {formatBRL(srv.valor)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEDIR COTAÇÃO PARA FORNECEDOR */}
      {quoteSupplierItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-slate-700 bg-[#181c23] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white">Pedir Cotação no WhatsApp</h3>
                <p className="text-xs text-orange-400 truncate">
                  {quoteSupplierItem.quantidade}x {quoteSupplierItem.descricao}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuoteSupplierItem(null)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {fornecedores.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">
                    Toque no fornecedor para abrir o WhatsApp:
                  </p>
                  {fornecedores.map((f) => {
                    const url = buildSupplierQuoteWhatsAppUrl({
                      supplierPhone: f.telefone,
                      supplierName: f.nome,
                      partName: quoteSupplierItem.descricao,
                      quantity: quoteSupplierItem.quantidade,
                      veiculo: selectedVeiculo,
                    });
                    return (
                      <a
                        key={f.id}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setQuoteSupplierItem(null)}
                        className="min-h-[58px] rounded-xl border border-slate-800 bg-[#0f1115] px-4 py-3 flex items-center justify-between gap-3 hover:border-emerald-500 transition"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{f.nome}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {f.especialidade || f.telefone}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shrink-0">
                          <MessageCircle className="h-4 w-4" />
                          Cotar
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Ou digite o WhatsApp de outro fornecedor:
                </label>
                <input
                  type="tel"
                  value={customSupplierPhone}
                  onChange={(e) => setCustomSupplierPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full min-h-[48px] rounded-xl border border-slate-700 bg-[#0f1115] px-3.5 text-base text-white focus:border-orange-500 focus:outline-none"
                />
                {customSupplierPhone.replace(/\D/g, '').length >= 10 && (
                  <a
                    href={buildSupplierQuoteWhatsAppUrl({
                      supplierPhone: customSupplierPhone,
                      supplierName: '',
                      partName: quoteSupplierItem.descricao,
                      quantity: quoteSupplierItem.quantidade,
                      veiculo: selectedVeiculo,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setQuoteSupplierItem(null)}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Enviar Cotação no WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteItemTarget)}
        title="Excluir item do orçamento?"
        description={`Deseja remover "${deleteItemTarget?.descricao}" deste orçamento?`}
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItemTarget(null)}
      />
    </div>
  );
};
