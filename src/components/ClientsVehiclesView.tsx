import React, { useMemo, useState } from 'react';
import {
  Car,
  ChevronRight,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { getStatusInfo } from '../data/checklistData';
import {
  calcQuoteTotals,
  formatBRL,
  formatDateBR,
  formatKm,
  formatPlacaDisplay,
  normalizePlaca,
} from '../lib/formatters';
import { formatSupabaseError, supabase } from '../lib/supabase';
import type { Cliente, Orcamento, Veiculo } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface ClientsVehiclesViewProps {
  userId: string;
  clientes: Cliente[];
  veiculos: Veiculo[];
  orcamentos: Orcamento[];
  onRefresh: () => Promise<void>;
  onOpenQuote: (orcamento: Orcamento) => void;
  onStartQuoteForVehicle: (clienteId: string, veiculoId: string) => void;
}

export const ClientsVehiclesView: React.FC<ClientsVehiclesViewProps> = ({
  userId,
  clientes,
  veiculos,
  orcamentos,
  onRefresh,
  onOpenQuote,
  onStartQuoteForVehicle,
}) => {
  const [subTab, setSubTab] = useState<'veiculos' | 'clientes'>('veiculos');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Histórico por placa
  const [historyVehicle, setHistoryVehicle] = useState<Veiculo | null>(null);

  // Modal Cliente
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [cNome, setCNome] = useState('');
  const [cTelefone, setCTelefone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // Modal Veículo
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Veiculo | null>(null);
  const [vClienteId, setVClienteId] = useState('');
  const [vPlaca, setVPlaca] = useState('');
  const [vMarca, setVMarca] = useState('');
  const [vModelo, setVModelo] = useState('');
  const [vAno, setVAno] = useState(String(new Date().getFullYear()));
  const [vKm, setVKm] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Exclusão
  const [deleteClientTarget, setDeleteClientTarget] = useState<Cliente | null>(null);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<Veiculo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const clientMap = useMemo(
    () => Object.fromEntries(clientes.map((c) => [c.id, c])),
    [clientes]
  );

  const openNewClient = () => {
    setEditingClient(null);
    setCNome('');
    setCTelefone('');
    setCEmail('');
    setErrorMsg(null);
    setClientModalOpen(true);
  };

  const openEditClient = (c: Cliente) => {
    setEditingClient(c);
    setCNome(c.nome);
    setCTelefone(c.telefone);
    setCEmail(c.email);
    setErrorMsg(null);
    setClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!cNome.trim()) {
      setErrorMsg('Informe o nome do cliente.');
      return;
    }
    setSavingClient(true);
    setErrorMsg(null);
    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clientes')
          .update({
            nome: cNome.trim(),
            telefone: cTelefone.trim(),
            email: cEmail.trim(),
          })
          .eq('id', editingClient.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clientes').insert({
          user_id: userId,
          nome: cNome.trim(),
          telefone: cTelefone.trim(),
          email: cEmail.trim(),
        });
        if (error) throw error;
      }
      await onRefresh();
      setClientModalOpen(false);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSavingClient(false);
    }
  };

  const openNewVehicle = (preselectedClientId?: string) => {
    setEditingVehicle(null);
    setVClienteId(preselectedClientId || clientes[0]?.id || '');
    setVPlaca('');
    setVMarca('');
    setVModelo('');
    setVAno(String(new Date().getFullYear()));
    setVKm('');
    setErrorMsg(null);
    setVehicleModalOpen(true);
  };

  const openEditVehicle = (v: Veiculo) => {
    setEditingVehicle(v);
    setVClienteId(v.cliente_id);
    setVPlaca(v.placa);
    setVMarca(v.marca);
    setVModelo(v.modelo);
    setVAno(String(v.ano || ''));
    setVKm(String(v.km || ''));
    setErrorMsg(null);
    setVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const cleanPlaca = normalizePlaca(vPlaca);
    if (!vClienteId) {
      setErrorMsg('Selecione ou cadastre um cliente primeiro.');
      return;
    }
    if (cleanPlaca.length < 7 || !vModelo.trim()) {
      setErrorMsg('Informe uma placa válida (7 caracteres) e o modelo do veículo.');
      return;
    }
    setSavingVehicle(true);
    setErrorMsg(null);
    try {
      const payload = {
        cliente_id: vClienteId,
        placa: cleanPlaca,
        marca: vMarca.trim(),
        modelo: vModelo.trim(),
        ano: Number(vAno) || new Date().getFullYear(),
        km: Number(vKm) || 0,
      };
      if (editingVehicle) {
        const { error } = await supabase
          .from('veiculos')
          .update(payload)
          .eq('id', editingVehicle.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('veiculos').insert({
          user_id: userId,
          ...payload,
        });
        if (error) throw error;
      }
      await onRefresh();
      setVehicleModalOpen(false);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!supabase || !deleteClientTarget) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', deleteClientTarget.id)
        .eq('user_id', userId);
      if (error) throw error;
      await onRefresh();
      setDeleteClientTarget(null);
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
      setDeleteClientTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!supabase || !deleteVehicleTarget) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('veiculos')
        .delete()
        .eq('id', deleteVehicleTarget.id)
        .eq('user_id', userId);
      if (error) throw error;
      await onRefresh();
      setDeleteVehicleTarget(null);
      if (historyVehicle?.id === deleteVehicleTarget.id) {
        setHistoryVehicle(null);
      }
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
      setDeleteVehicleTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return veiculos.filter((v) => {
      if (!q) return true;
      const owner = clientMap[v.cliente_id]?.nome.toLowerCase() || '';
      return (
        v.placa.toLowerCase().includes(q) ||
        formatPlacaDisplay(v.placa).toLowerCase().includes(q) ||
        v.marca.toLowerCase().includes(q) ||
        v.modelo.toLowerCase().includes(q) ||
        owner.includes(q)
      );
    });
  }, [veiculos, search, clientMap]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clientes.filter((c) => {
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [clientes, search]);

  const historyQuotes = useMemo(() => {
    if (!historyVehicle) return [];
    const targetPlaca = normalizePlaca(historyVehicle.placa);
    return orcamentos.filter(
      (o) =>
        o.veiculo_id === historyVehicle.id ||
        normalizePlaca(o.veiculos?.placa || '') === targetPlaca
    );
  }, [historyVehicle, orcamentos]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Clientes e Veículos
          </h2>
          <p className="text-sm text-slate-400">
            Consulte o histórico completo de serviços e orçamentos por placa.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openNewClient}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-orange-400" />
            <span>Cliente</span>
          </button>
          <button
            type="button"
            onClick={() => openNewVehicle()}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-slate-950 hover:bg-orange-400 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Veículo</span>
          </button>
        </div>
      </div>

      {errorMsg && !clientModalOpen && !vehicleModalOpen && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Abas */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#181c23] p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => setSubTab('veiculos')}
          className={`min-h-[46px] rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
            subTab === 'veiculos'
              ? 'bg-orange-500 text-slate-950'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Car className="h-4 w-4" />
          <span>Veículos ({veiculos.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('clientes')}
          className={`min-h-[46px] rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
            subTab === 'clientes'
              ? 'bg-orange-500 text-slate-950'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <User className="h-4 w-4" />
          <span>Clientes ({clientes.length})</span>
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            subTab === 'veiculos'
              ? 'Buscar por placa, marca, modelo ou dono...'
              : 'Buscar por nome, telefone ou e-mail...'
          }
          className="w-full min-h-[50px] rounded-xl border border-slate-800 bg-[#181c23] pl-12 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {/* Lista de Veículos / Placas */}
      {subTab === 'veiculos' ? (
        filteredVehicles.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-8 text-center">
            <Car className="h-10 w-10 mx-auto text-slate-600 mb-2" />
            <p className="text-base font-semibold text-slate-200">Nenhum veículo cadastrado</p>
            <p className="mt-1 text-sm text-slate-400">
              Cadastre um cliente e adicione os veículos dele para acompanhar o histórico por placa.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredVehicles.map((v) => {
              const owner = clientMap[v.cliente_id];
              const qCount = orcamentos.filter(
                (o) => normalizePlaca(o.veiculos?.placa || '') === normalizePlaca(v.placa)
              ).length;

              return (
                <div
                  key={v.id}
                  className="rounded-2xl border border-slate-800 bg-[#181c23] overflow-hidden flex items-stretch"
                >
                  <button
                    type="button"
                    onClick={() => setHistoryVehicle(v)}
                    className="flex-1 min-w-0 p-4 text-left hover:bg-slate-800/30 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono-num text-base font-bold tracking-wider text-orange-400">
                          {formatPlacaDisplay(v.placa)}
                        </span>
                        <span className="text-base font-bold text-slate-100 truncate">
                          {v.marca} {v.modelo}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{owner?.nome || 'Sem cliente'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{v.ano}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{formatKm(v.km)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-300 font-semibold">
                          {qCount} {qCount === 1 ? 'orçamento' : 'orçamentos'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-orange-400 shrink-0">
                      <History className="h-4 w-4" />
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>

                  <div className="flex flex-col border-l border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => openEditVehicle(v)}
                      aria-label={`Editar placa ${v.placa}`}
                      className="flex-1 min-w-[46px] flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteVehicleTarget(v)}
                      aria-label={`Excluir placa ${v.placa}`}
                      className="flex-1 min-w-[46px] border-t border-slate-800/80 flex items-center justify-center text-slate-500 hover:bg-red-500/15 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#181c23] p-8 text-center">
          <User className="h-10 w-10 mx-auto text-slate-600 mb-2" />
          <p className="text-base font-semibold text-slate-200">Nenhum cliente cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredClients.map((c) => {
            const cars = veiculos.filter((v) => v.cliente_id === c.id);
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-800 bg-[#181c23] p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-100 truncate">{c.nome}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono-num text-slate-300">
                        {c.telefone || 'Sem telefone'}
                      </span>
                      {c.email && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{c.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditClient(c)}
                      aria-label={`Editar ${c.nome}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteClientTarget(c)}
                      aria-label={`Excluir ${c.nome}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-500/15 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {cars.length === 0 ? (
                      <span className="text-slate-500">Sem veículos vinculados</span>
                    ) : (
                      cars.map((car) => (
                        <button
                          key={car.id}
                          type="button"
                          onClick={() => setHistoryVehicle(car)}
                          className="font-mono-num font-semibold text-orange-400 hover:underline"
                        >
                          {formatPlacaDisplay(car.placa)} ({car.modelo})
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openNewVehicle(c.id)}
                    className="min-h-[38px] px-3 rounded-lg bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    + Veículo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Histórico por Placa */}
      {historyVehicle && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm"
        >
          <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-[#141820] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-num text-xl font-bold text-orange-400">
                    {formatPlacaDisplay(historyVehicle.placa)}
                  </span>
                  <span className="text-base font-bold text-white truncate">
                    {historyVehicle.marca} {historyVehicle.modelo} ({historyVehicle.ano})
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proprietário: {clientMap[historyVehicle.cliente_id]?.nome || '-'} ·{' '}
                  {formatKm(historyVehicle.km)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryVehicle(null)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {historyQuotes.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#181c23] p-6 text-center">
                  <p className="text-sm font-semibold text-slate-300">
                    Nenhum orçamento ou serviço anterior para esta placa.
                  </p>
                </div>
              ) : (
                historyQuotes.map((orc) => {
                  const items = orc.orcamento_itens || [];
                  const totals = calcQuoteTotals(items, orc.desconto);
                  const st = getStatusInfo(orc.status);

                  return (
                    <button
                      key={orc.id}
                      type="button"
                      onClick={() => {
                        setHistoryVehicle(null);
                        onOpenQuote(orc);
                      }}
                      className="w-full text-left rounded-2xl border border-slate-800 bg-[#181c23] p-4 hover:border-orange-500/60 transition space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-bold ${st.colorClass}`}>{st.label}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num text-slate-400">
                            {formatDateBR(orc.criado_em)}
                          </span>
                        </div>
                        <span className="font-mono-num text-base font-bold text-white">
                          {formatBRL(totals.total)}
                        </span>
                      </div>

                      {items.length > 0 && (
                        <ul className="space-y-1 text-xs text-slate-300">
                          {items.slice(0, 5).map((item) => (
                            <li key={item.id} className="truncate">
                              • {item.tipo === 'peca' ? '[Peça]' : '[M.O.]'} {item.descricao} (
                              {formatBRL(item.valor_unitario * item.quantidade)})
                            </li>
                          ))}
                          {items.length > 5 && (
                            <li className="text-slate-500">
                              + {items.length - 5} outros itens...
                            </li>
                          )}
                        </ul>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-800 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  const v = historyVehicle;
                  setHistoryVehicle(null);
                  onStartQuoteForVehicle(v.cliente_id, v.id);
                }}
                className="w-full min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-slate-950 hover:bg-orange-400"
              >
                <Plus className="h-5 w-5" />
                <span>Novo Orçamento para esta Placa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cliente */}
      {clientModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#181c23] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button
                type="button"
                onClick={() => setClientModalOpen(false)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Nome completo *
                </label>
                <input
                  type="text"
                  required
                  value={cNome}
                  onChange={(e) => setCNome(e.target.value)}
                  placeholder="Ex.: João Carlos"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  WhatsApp / Telefone
                </label>
                <input
                  type="tel"
                  value={cTelefone}
                  onChange={(e) => setCTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  placeholder="cliente@email.com"
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
                disabled={savingClient}
                className="w-full min-h-[52px] rounded-xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
              >
                {savingClient ? 'Salvando...' : 'Salvar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Veículo */}
      {vehicleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#181c23] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-white">
                {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
              </h3>
              <button
                type="button"
                onClick={() => setVehicleModalOpen(false)}
                aria-label="Fechar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Cliente proprietário *
                </label>
                <select
                  required
                  value={vClienteId}
                  onChange={(e) => setVClienteId(e.target.value)}
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">Selecione um cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                    Placa *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={vPlaca}
                    onChange={(e) => setVPlaca(normalizePlaca(e.target.value))}
                    placeholder="ABC1D23"
                    className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num uppercase text-orange-300 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={vMarca}
                    onChange={(e) => setVMarca(e.target.value)}
                    placeholder="Ex.: VW, Fiat"
                    className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                  Modelo *
                </label>
                <input
                  type="text"
                  required
                  value={vModelo}
                  onChange={(e) => setVModelo(e.target.value)}
                  placeholder="Ex.: Gol 1.6 MSI"
                  className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                    Ano
                  </label>
                  <input
                    type="number"
                    min="1950"
                    max="2035"
                    value={vAno}
                    onChange={(e) => setVAno(e.target.value)}
                    className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num text-slate-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                    Quilometragem (km)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={vKm}
                    onChange={(e) => setVKm(e.target.value)}
                    placeholder="85000"
                    className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base font-mono-num text-slate-100 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={savingVehicle}
                className="w-full min-h-[52px] rounded-xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
              >
                {savingVehicle ? 'Salvando...' : 'Salvar Veículo'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteClientTarget)}
        title="Excluir cliente?"
        description={`Tem certeza que deseja excluir "${deleteClientTarget?.nome}"? Veículos vinculados também serão removidos (se não houver orçamentos).`}
        loading={deleting}
        onConfirm={handleDeleteClient}
        onCancel={() => setDeleteClientTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteVehicleTarget)}
        title="Excluir veículo?"
        description={`Tem certeza que deseja excluir o veículo placa ${formatPlacaDisplay(
          deleteVehicleTarget?.placa
        )}?`}
        loading={deleting}
        onConfirm={handleDeleteVehicle}
        onCancel={() => setDeleteVehicleTarget(null)}
      />
    </div>
  );
};
