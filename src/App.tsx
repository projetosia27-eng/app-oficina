import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Building2,
  ClipboardList,
  Database,
  Plus,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { ClientsVehiclesView } from './components/ClientsVehiclesView';
import { HomeQuotesView } from './components/HomeQuotesView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OrcamentoEditor } from './components/OrcamentoEditor';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SqlSetupModal } from './components/SqlSetupModal';
import { StandardServicesView } from './components/StandardServicesView';
import { SuppliersView } from './components/SuppliersView';
import { WorkshopProfileView } from './components/WorkshopProfileView';
import { formatSupabaseError, isSupabaseConfigured, supabase } from './lib/supabase';
import type {
  AppTab,
  Cliente,
  Fornecedor,
  Oficina,
  Orcamento,
  ServicoPadrao,
  Veiculo,
} from './types';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<AppTab>('inicio');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingOrcamento, setEditingOrcamento] = useState<Orcamento | null>(null);
  const [preselectedClienteId, setPreselectedClienteId] = useState<string | undefined>();
  const [preselectedVeiculoId, setPreselectedVeiculoId] = useState<string | undefined>();

  const [oficina, setOficina] = useState<Oficina | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [servicosPadrao, setServicosPadrao] = useState<ServicoPadrao[]>([]);

  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadAllData = useCallback(async () => {
    if (!supabase || !session?.user) return;
    setDataLoading(true);
    setDataError(null);

    try {
      const uid = session.user.id;
      const [oficinaRes, clientesRes, veiculosRes, orcRes, fornRes, srvRes] = await Promise.all([
        supabase.from('oficinas').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('clientes').select('*').eq('user_id', uid).order('nome'),
        supabase.from('veiculos').select('*').eq('user_id', uid).order('placa'),
        supabase
          .from('orcamentos')
          .select('*, clientes(*), veiculos(*), orcamento_itens(*)')
          .eq('user_id', uid)
          .order('criado_em', { ascending: false }),
        supabase.from('fornecedores').select('*').eq('user_id', uid).order('nome'),
        supabase.from('servicos_padrao').select('*').eq('user_id', uid).order('nome'),
      ]);

      const firstErr =
        oficinaRes.error ||
        clientesRes.error ||
        veiculosRes.error ||
        orcRes.error ||
        fornRes.error ||
        srvRes.error;

      if (firstErr) throw firstErr;

      setOficina((oficinaRes.data as Oficina) || null);
      setClientes((clientesRes.data as Cliente[]) || []);
      setVeiculos((veiculosRes.data as Veiculo[]) || []);
      setOrcamentos((orcRes.data as Orcamento[]) || []);
      setFornecedores((fornRes.data as Fornecedor[]) || []);
      setServicosPadrao((srvRes.data as ServicoPadrao[]) || []);
    } catch (err) {
      setDataError(formatSupabaseError(err));
    } finally {
      setDataLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (session?.user) {
      loadAllData();
    }
  }, [session?.user, loadAllData]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOficina(null);
    setClientes([]);
    setVeiculos([]);
    setOrcamentos([]);
    setFornecedores([]);
    setServicosPadrao([]);
    setEditorOpen(false);
    setActiveTab('inicio');
  };

  const openNewQuote = (cId?: string, vId?: string) => {
    setEditingOrcamento(null);
    setPreselectedClienteId(cId);
    setPreselectedVeiculoId(vId);
    setEditorOpen(true);
  };

  const openExistingQuote = (orc: Orcamento) => {
    setEditingOrcamento(orc);
    setPreselectedClienteId(undefined);
    setPreselectedVeiculoId(undefined);
    setEditorOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-[#0f1115] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-300">
          <Wrench className="h-6 w-6 text-orange-500 animate-spin" />
          <span className="font-semibold">Carregando OficinaPro...</span>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <>
        <AuthScreen />
        <OfflineIndicator />
      </>
    );
  }

  const navItems: { id: AppTab; label: string; shortLabel: string; icon: typeof ClipboardList }[] = [
    { id: 'inicio', label: 'Orçamentos', shortLabel: 'Início', icon: ClipboardList },
    { id: 'clientes', label: 'Clientes', shortLabel: 'Clientes', icon: Users },
    { id: 'fornecedores', label: 'Fornecedores', shortLabel: 'Peças', icon: Truck },
    { id: 'servicos', label: 'Serviços', shortLabel: 'Serviços', icon: Wrench },
    { id: 'oficina', label: 'Minha Oficina', shortLabel: 'Oficina', icon: Building2 },
  ];

  return (
    <div className="min-h-dvh bg-[#0f1115] text-slate-100 flex flex-col">
      {/* Barra Superior (3 zonas limpas) */}
      <header className="sticky top-0 z-30 h-12 md:h-16 border-b border-slate-800/90 bg-[#0f1115]/95 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6">
          {/* Zona 1: Marca */}
          <button
            type="button"
            onClick={() => {
              setEditorOpen(false);
              setActiveTab('inicio');
            }}
            className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Wrench className="h-5 w-5 text-orange-500 shrink-0" />
            <span>OficinaPro</span>
          </button>

          {/* Zona 2: Links desktop */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            {navItems.map((item) => {
              const active = !editorOpen && activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setEditorOpen(false);
                    setActiveTab(item.id);
                  }}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition ${
                    active
                      ? 'border-orange-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zona 3: 1 Ação Principal */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block md:hidden">
              <PWAInstallButton compact />
            </div>
            <button
              type="button"
              onClick={() => openNewQuote()}
              className="min-h-[38px] md:min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 md:px-4 text-xs md:text-sm font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Novo Orçamento</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 py-5 pb-24 md:pb-10">
        {dataError && (
          <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-red-200">{dataError}</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 text-xs font-bold text-orange-400 hover:bg-slate-700"
              >
                <Database className="h-4 w-4" />
                <span>Ver Script SQL</span>
              </button>
              <button
                type="button"
                onClick={loadAllData}
                className="min-h-[42px] rounded-xl bg-red-600 px-3.5 text-xs font-bold text-white hover:bg-red-500"
              >
                Tentar de novo
              </button>
            </div>
          </div>
        )}

        {editorOpen ? (
          <OrcamentoEditor
            userId={session.user.id}
            oficina={oficina}
            clientes={clientes}
            veiculos={veiculos}
            fornecedores={fornecedores}
            servicosPadrao={servicosPadrao}
            initialOrcamento={editingOrcamento}
            preselectedClienteId={preselectedClienteId}
            preselectedVeiculoId={preselectedVeiculoId}
            onClose={() => {
              setEditorOpen(false);
              loadAllData();
            }}
            onSaved={loadAllData}
          />
        ) : activeTab === 'inicio' ? (
          <HomeQuotesView
            userId={session.user.id}
            orcamentos={orcamentos}
            loading={dataLoading}
            onCreateNew={() => openNewQuote()}
            onOpenQuote={openExistingQuote}
            onRefresh={loadAllData}
          />
        ) : activeTab === 'clientes' ? (
          <ClientsVehiclesView
            userId={session.user.id}
            clientes={clientes}
            veiculos={veiculos}
            orcamentos={orcamentos}
            onRefresh={loadAllData}
            onOpenQuote={openExistingQuote}
            onStartQuoteForVehicle={(cId, vId) => openNewQuote(cId, vId)}
          />
        ) : activeTab === 'fornecedores' ? (
          <SuppliersView
            userId={session.user.id}
            fornecedores={fornecedores}
            onRefresh={loadAllData}
          />
        ) : activeTab === 'servicos' ? (
          <StandardServicesView
            userId={session.user.id}
            servicos={servicosPadrao}
            onRefresh={loadAllData}
          />
        ) : (
          <WorkshopProfileView
            userId={session.user.id}
            userEmail={session.user.email || ''}
            oficina={oficina}
            onUpdated={(next) => setOficina(next)}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Navegação Inferior Fixa para Polegar (Mobile) */}
      {!editorOpen && (
        <nav
          aria-label="Navegação principal"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-[#0f1115]/95 backdrop-blur-md pb-safe"
        >
          <div className="grid grid-cols-5 h-14 items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center h-full transition ${
                    active ? 'text-orange-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-0.5 text-[10px] font-semibold tracking-tight whitespace-nowrap">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <OfflineIndicator />
      <SqlSetupModal open={showSqlModal} onClose={() => setShowSqlModal(false)} />
    </div>
  );
}
