import React, { useMemo, useState } from 'react';
import { ChevronRight, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { getStatusInfo, STATUS_OPTIONS } from '../data/checklistData';
import { calcQuoteTotals, formatBRL, formatDateBR, formatPlacaDisplay } from '../lib/formatters';
import { formatSupabaseError, supabase } from '../lib/supabase';
import type { Orcamento, OrcamentoStatus } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface HomeQuotesViewProps {
  userId: string;
  orcamentos: Orcamento[];
  loading: boolean;
  onCreateNew: () => void;
  onOpenQuote: (orcamento: Orcamento) => void;
  onRefresh: () => Promise<void>;
}

export const HomeQuotesView: React.FC<HomeQuotesViewProps> = ({
  userId,
  orcamentos,
  loading,
  onCreateNew,
  onOpenQuote,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | OrcamentoStatus>('todos');
  const [deleteTarget, setDeleteTarget] = useState<Orcamento | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orcamentos.filter((orc) => {
      if (statusFilter !== 'todos' && orc.status !== statusFilter) return false;
      if (!q) return true;
      const placa = (orc.veiculos?.placa || '').toLowerCase();
      const placaDash = formatPlacaDisplay(orc.veiculos?.placa).toLowerCase();
      const modelo = `${orc.veiculos?.marca || ''} ${orc.veiculos?.modelo || ''}`.toLowerCase();
      const cliente = (orc.clientes?.nome || '').toLowerCase();
      return (
        placa.includes(q) ||
        placaDash.includes(q) ||
        modelo.includes(q) ||
        cliente.includes(q)
      );
    });
  }, [orcamentos, search, statusFilter]);

  const counts = useMemo(() => {
    const abertos = orcamentos.filter(
      (o) => o.status === 'rascunho' || o.status === 'enviado'
    ).length;
    const emServico = orcamentos.filter(
      (o) => o.status === 'aprovado' || o.status === 'em_servico'
    ).length;
    return { total: orcamentos.length, abertos, emServico };
  }, [orcamentos]);

  const handleDelete = async () => {
    if (!supabase || !deleteTarget) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('orcamentos')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('user_id', userId);
      if (error) throw error;
      await onRefresh();
      setDeleteTarget(null);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho com CTA principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Orçamentos
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-slate-400 font-mono-num">
            <span>{counts.total} registrados</span>
            <span aria-hidden="true">·</span>
            <span>{counts.abertos} aguardando</span>
            <span aria-hidden="true">·</span>
            <span className="text-orange-400 font-semibold">{counts.emServico} ativos</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="min-h-[54px] inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-base font-bold text-slate-950 shadow-lg shadow-orange-500/20 hover:bg-orange-400 active:scale-[0.98] transition whitespace-nowrap shrink-0"
        >
          <Plus className="h-5 w-5 stroke-[2.5]" />
          <span>Novo Orçamento</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Busca por placa ou nome */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por placa (ex.: ABC1D23), carro ou nome do cliente..."
          className="w-full min-h-[52px] rounded-2xl border border-slate-800 bg-[#181c23] pl-12 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {/* Filtros de status */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setStatusFilter('todos')}
          className={`min-h-[42px] rounded-xl px-4 text-sm font-semibold transition whitespace-nowrap shrink-0 ${
            statusFilter === 'todos'
              ? 'bg-orange-500 text-slate-950'
              : 'bg-[#181c23] text-slate-300 border border-slate-800 hover:border-slate-700'
          }`}
        >
          Todos
        </button>
        {STATUS_OPTIONS.map((st) => (
          <button
            key={st.value}
            type="button"
            onClick={() => setStatusFilter(st.value)}
            className={`min-h-[42px] rounded-xl px-4 text-sm font-semibold transition whitespace-nowrap shrink-0 ${
              statusFilter === st.value
                ? 'bg-orange-500 text-slate-950'
                : 'bg-[#181c23] text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-32 rounded-2xl border border-slate-800 bg-[#181c23] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-200">
            {orcamentos.length === 0
              ? 'Nenhum orçamento criado ainda'
              : 'Nenhum orçamento corresponde ao filtro'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Toque em "Novo Orçamento" para montar o primeiro orçamento pelo celular.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((orc) => {
            const items = orc.orcamento_itens || [];
            const totals = calcQuoteTotals(items, orc.desconto);
            const statusInfo = getStatusInfo(orc.status);

            return (
              <div
                key={orc.id}
                className="rounded-2xl border border-slate-800 bg-[#181c23] hover:border-slate-700 transition flex items-stretch overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onOpenQuote(orc)}
                  className="flex-1 min-w-0 p-4 text-left flex flex-col justify-between gap-3 active:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono-num text-base font-bold tracking-wider text-orange-400">
                          {formatPlacaDisplay(orc.veiculos?.placa)}
                        </span>
                        <span className="text-sm font-semibold text-slate-200 truncate">
                          {orc.veiculos?.marca} {orc.veiculos?.modelo}{' '}
                          {orc.veiculos?.ano ? `${orc.veiculos.ano}` : ''}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300 truncate font-medium">
                        {orc.clientes?.nome || 'Cliente não informado'}
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
                      <span className={`font-semibold ${statusInfo.colorClass}`}>
                        {statusInfo.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{formatDateBR(orc.criado_em)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{items.length} itens</span>
                    </div>

                    <span className="font-mono-num text-base font-bold text-white shrink-0">
                      {formatBRL(totals.total)}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(orc)}
                  aria-label="Excluir orçamento"
                  className="min-w-[48px] flex items-center justify-center border-l border-slate-800/80 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Excluir orçamento?"
        description={`Deseja excluir o orçamento da placa ${formatPlacaDisplay(
          deleteTarget?.veiculos?.placa
        )}? Todos os itens vinculados serão apagados.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
