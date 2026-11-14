import React, { useState } from 'react';
import { MessageCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { sanitizePhoneForWhatsApp } from '../lib/formatters';
import { formatSupabaseError, supabase } from '../lib/supabase';
import type { Fornecedor } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SuppliersViewProps {
  userId: string;
  fornecedores: Fornecedor[];
  onRefresh: () => Promise<void>;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  userId,
  fornecedores,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [especialidade, setEspecialidade] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Fornecedor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openNew = () => {
    setEditing(null);
    setNome('');
    setTelefone('');
    setEspecialidade('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEdit = (f: Fornecedor) => {
    setEditing(f);
    setNome(f.nome);
    setTelefone(f.telefone);
    setEspecialidade(f.especialidade);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!nome.trim() || !telefone.trim()) {
      setErrorMsg('Informe o nome e o telefone do fornecedor.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      if (editing) {
        const { error } = await supabase
          .from('fornecedores')
          .update({
            nome: nome.trim(),
            telefone: telefone.trim(),
            especialidade: especialidade.trim(),
          })
          .eq('id', editing.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fornecedores').insert({
          user_id: userId,
          nome: nome.trim(),
          telefone: telefone.trim(),
          especialidade: especialidade.trim(),
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
        .from('fornecedores')
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

  const filtered = fornecedores.filter((f) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      f.nome.toLowerCase().includes(q) ||
      f.especialidade.toLowerCase().includes(q) ||
      f.telefone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Fornecedores de Peças
          </h2>
          <p className="text-sm text-slate-400">
            Autopeças e distribuidores para pedir cotação com 1 toque.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition whitespace-nowrap shrink-0"
        >
          <Plus className="h-5 w-5" />
          <span>Novo Fornecedor</span>
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
          placeholder="Buscar por nome ou especialidade (ex.: freios, elétrica)..."
          className="w-full min-h-[50px] rounded-xl border border-slate-800 bg-[#181c23] pl-12 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-8 text-center">
          <p className="text-base font-semibold text-slate-200">
            Nenhum fornecedor encontrado
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Cadastre suas autopeças favoritas para cotar peças pelo WhatsApp direto do orçamento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((f) => {
            const waPhone = sanitizePhoneForWhatsApp(f.telefone);
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
              `Olá ${f.nome}! Tudo bem? Gostaria de verificar disponibilidade e preço de peças.`
            )}`;

            return (
              <div
                key={f.id}
                className="rounded-2xl border border-slate-800 bg-[#181c23] p-4 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-100">{f.nome}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(f)}
                        aria-label={`Editar ${f.nome}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(f)}
                        aria-label={`Excluir ${f.nome}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-500/15 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    <span>{f.especialidade || 'Autopeças em geral'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num text-slate-300">{f.telefone}</span>
                  </div>
                </div>

                {waPhone && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 active:scale-[0.98] transition"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span>Chamar no WhatsApp</span>
                  </a>
                )}
              </div>
            );
          })}
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
                {editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
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
                  Nome da autopeça / fornecedor *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Distribuidora Central Peças"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  WhatsApp / Telefone *
                </label>
                <input
                  type="tel"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 98888-7777"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Especialidade
                </label>
                <input
                  type="text"
                  value={especialidade}
                  onChange={(e) => setEspecialidade(e.target.value)}
                  placeholder="Ex.: Freios e suspensão, Elétrica, Linha VW/Fiat"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
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
                {saving ? 'Salvando...' : 'Salvar Fornecedor'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Excluir fornecedor?"
        description={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? Essa ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
