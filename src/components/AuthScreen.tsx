import React, { useState } from 'react';
import { AlertCircle, Database, Lock, Mail, Wrench } from 'lucide-react';
import { formatSupabaseError, isSupabaseConfigured, supabase } from '../lib/supabase';
import { PWAInstallButton } from './PWAInstallButton';
import { SqlSetupModal } from './SqlSetupModal';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg(
        'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente.'
      );
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Preencha e-mail e senha para continuar.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.session) {
          setSuccessMsg(
            'Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.'
          );
        }
      }
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#0f1115] text-slate-100 flex flex-col justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-slate-950 shadow-lg shadow-orange-500/20">
              <Wrench className="h-6 w-6 stroke-[2.4]" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white leading-none">
                OficinaPro
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Orçamentos rápidos no chão da oficina
              </p>
            </div>
          </div>
          <PWAInstallButton compact />
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <p className="font-semibold text-amber-100">Configuração do Supabase pendente</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/90">
              Configure as variáveis <code className="font-mono-num">VITE_SUPABASE_URL</code> e{' '}
              <code className="font-mono-num">VITE_SUPABASE_ANON_KEY</code> no ambiente e rode o
              Script SQL abaixo no seu projeto Supabase.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-slate-800 bg-[#181c23] p-6 shadow-xl">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#0f1115] p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`min-h-[44px] rounded-lg text-sm font-semibold transition ${
                mode === 'signup'
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-sm font-semibold text-slate-200 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@oficina.com.br"
                  className="w-full min-h-[52px] rounded-xl border border-slate-700 bg-[#0f1115] pl-11 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-pass" className="block text-sm font-semibold text-slate-200 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <input
                  id="auth-pass"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full min-h-[52px] rounded-xl border border-slate-700 bg-[#0f1115] pl-11 pr-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm text-emerald-200">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[54px] rounded-xl bg-orange-500 text-base font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition disabled:opacity-50"
            >
              {loading
                ? 'Aguarde...'
                : mode === 'login'
                ? 'Entrar na Oficina'
                : 'Cadastrar Oficina'}
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={() => setShowSql(true)}
          className="mt-4 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#141820] px-4 text-sm font-medium text-slate-300 hover:border-slate-700 hover:text-white transition"
        >
          <Database className="h-4 w-4 text-orange-400" />
          <span>Ver Script SQL (Tabelas + RLS do Supabase)</span>
        </button>
      </div>

      <SqlSetupModal open={showSql} onClose={() => setShowSql(false)} />
    </div>
  );
};
