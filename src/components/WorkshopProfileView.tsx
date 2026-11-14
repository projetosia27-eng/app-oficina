import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Database,
  LogOut,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatSupabaseError, supabase } from '../lib/supabase';
import type { Oficina } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { PWAInstallButton } from './PWAInstallButton';
import { SqlSetupModal } from './SqlSetupModal';

const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB (plano gratuito Supabase)

interface WorkshopProfileViewProps {
  userId: string;
  userEmail: string;
  oficina: Oficina | null;
  onUpdated: (oficina: Oficina) => void;
  onSignOut: () => void;
}

export const WorkshopProfileView: React.FC<WorkshopProfileViewProps> = ({
  userId,
  userEmail,
  oficina,
  onUpdated,
  onSignOut,
}) => {
  const [nome, setNome] = useState(oficina?.nome || '');
  const [telefone, setTelefone] = useState(oficina?.telefone || '');
  const [email, setEmail] = useState(oficina?.email || userEmail || '');
  const [endereco, setEndereco] = useState(oficina?.endereco || '');
  const [cnpjCpf, setCnpjCpf] = useState(oficina?.cnpj_cpf || '');
  const [logoUrl, setLogoUrl] = useState<string | null>(oficina?.logo_url || null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (oficina) {
      setNome(oficina.nome || '');
      setTelefone(oficina.telefone || '');
      setEmail(oficina.email || userEmail || '');
      setEndereco(oficina.endereco || '');
      setCnpjCpf(oficina.cnpj_cpf || '');
      setLogoUrl(oficina.logo_url || null);
    }
  }, [oficina, userEmail]);

  const persistOficina = async (nextLogoUrl: string | null) => {
    if (!supabase) return;
    const payload = {
      user_id: userId,
      nome: nome.trim() || 'Minha Oficina',
      telefone: telefone.trim(),
      email: email.trim(),
      endereco: endereco.trim(),
      cnpj_cpf: cnpjCpf.trim() || null,
      logo_url: nextLogoUrl,
      atualizado_em: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('oficinas')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    onUpdated(data as Oficina);
    return data as Oficina;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!nome.trim()) {
      setErrorMsg('Informe o nome da oficina.');
      return;
    }

    setSaving(true);
    try {
      await persistOficina(logoUrl);
      setSuccessMsg('Dados da oficina salvos com sucesso!');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMsg('Use uma imagem PNG, JPG ou WEBP.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setErrorMsg(
        `A logo tem ${(file.size / (1024 * 1024)).toFixed(2)} MB. O limite no plano gratuito é de 1 MB.`
      );
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${userId}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      setLogoUrl(publicUrl);
      await persistOficina(publicUrl);
      setSuccessMsg('Logo enviada e salva!');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!supabase) return;
    setConfirmRemoveLogo(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);
    try {
      setLogoUrl(null);
      await persistOficina(null);
      setSuccessMsg('Logo removida do perfil.');
    } catch (err) {
      setErrorMsg(formatSupabaseError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Minha Oficina
          </h2>
          <p className="text-sm text-slate-400">
            Esses dados e a logo aparecem no cabeçalho dos seus PDFs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <LogOut className="h-4 w-4 text-orange-400" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Card da Logo */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#181c23] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100">Logo da Oficina</h3>
            <span className="text-xs text-slate-400">Máx. 1 MB</span>
          </div>

          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-[#0f1115] p-6 min-h-[160px]">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo da oficina"
                referrerPolicy="no-referrer"
                className="max-h-32 max-w-full rounded-xl object-contain"
              />
            ) : (
              <div className="text-center text-slate-500">
                <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">Nenhuma logo enviada</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoUpload}
            className="hidden"
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-700 active:scale-[0.98] transition disabled:opacity-50"
            >
              <Upload className="h-4 w-4 text-orange-400" />
              <span>{uploading ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}</span>
            </button>

            {logoUrl && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => setConfirmRemoveLogo(true)}
                aria-label="Remover logo"
                className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Formatos PNG, JPG ou WEBP até 1 MB (economiza espaço no plano gratuito do Supabase).
          </p>
        </div>

        {/* Formulário de Dados */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 rounded-2xl border border-slate-800 bg-[#181c23] p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Nome da oficina *
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Auto Mecânica Silva"
                className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Telefone / WhatsApp
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                E-mail comercial
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@oficina.com.br"
                className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                CNPJ ou CPF (opcional)
              </label>
              <input
                type="text"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-200 mb-1.5">
                Endereço
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua das Oficinas, 120 - Centro"
                className="w-full min-h-[50px] rounded-xl border border-slate-700 bg-[#0f1115] px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-base font-bold text-slate-950 hover:bg-orange-400 active:scale-[0.98] transition disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              <span>{saving ? 'Salvando...' : 'Salvar Dados da Oficina'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSql(true)}
              className="min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              <Database className="h-4 w-4 text-orange-400" />
              <span>Script SQL</span>
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={confirmRemoveLogo}
        title="Remover logo da oficina?"
        description="A logo deixará de aparecer nos novos PDFs gerados. Você pode enviar outra quando quiser."
        confirmLabel="Sim, remover"
        onConfirm={handleDeleteLogo}
        onCancel={() => setConfirmRemoveLogo(false)}
      />

      <SqlSetupModal open={showSql} onClose={() => setShowSql(false)} />
    </div>
  );
};
