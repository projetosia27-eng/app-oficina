import React, { useState } from 'react';
import { Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import { formatBRL } from '../lib/formatters';
import { formatSupabaseError, supabase } from '../lib/supabase';
import type { ServicoPadrao } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface StandardServicesViewProps {
  userId: string;
  servicos: ServicoPadrao[];
  onRefresh: () => Promise<void>;
}

export const StandardServicesView: React.FC<StandardServicesViewProps> = ({
  userId,
  servicos,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ServicoPadrao | null>(null);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServicoPadrao | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openNew = () => {
    setEditing(null);
    setNome('');
    setValor('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEdit = (s: ServicoPadrao) => {
    setEditing(s);
    setNome(s.nome);
    setValor(String(s.valor));
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const numericValor = Number(valor.replace(',', '.'));
    if (!nome.trim() || Number.isNaN(numericValor) || numericValor < 0) {
      setErrorMsg('Informe um nome válido e um valor numérico.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      if (editing) {
        const { error } = await supabase
          .from('servicos_padrao')
          .update({ nome: nome.trim(), valor: numericValor })
          .eq('id', editing.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('servicos_padrao').insert({
          user_id: userId,
          nome: nome.trim(),
          valor: numericValor,
        });
        if (error) throw error;
      }
      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!supabase || !deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('servicos_padrao')
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

  const filtered = servicos.filter((s) =>
    s.nome.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Serviços Padrão
          </h2>
          <p className="text-sm text-slate-400">
            Tabela de serviços com preço fixo para lançar rápido nos orçamentos.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition whitespace-nowrap shrink-0"
        >
          <Plus className="h-5 w-5" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {errorMsg && !modalOpen && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar serviço (ex.: Troca de óleo, Alinhamento)..."
          className="w-full min-h-[50px] rounded-xl border border-slate-800 bg-[#181c23] pl-12 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-8 text-center">
          <Wrench className="h-10 w-10 mx-auto text-slate-600 mb-2" />
          <p className="text-base font-semibold text-slate-200">
            Nenhum serviço padrão cadastrado
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Exemplos: Troca de óleo (R$ 80,00), Alinhamento 3D (R$ 120,00), Scanner (R$ 100,00).
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-[#181c23] overflow-hidden">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 p-4 hover:bg-slate-800/30 transition"
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-100 truncate">{s.nome}</p>
                <p className="font-mono-num text-sm font-bold text-orange-400 mt-0.5">
                  {formatBRL(s.valor)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(s)}
                  aria-label={`Editar ${s.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(s)}
                  aria-label={`Excluir ${s.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-500/15 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#181c23] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-white">
                {editing ? 'Editar Serviço Padrão' : 'Novo Serviço Padrão'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Nome do serviço *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Troca de óleo e filtro"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Valor fixo (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="120.00"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[52px] rounded-xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Serviço'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Excluir serviço padrão?"
        description={`Tem certeza que deseja excluir "${deleteTarget?.nome}"?`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
