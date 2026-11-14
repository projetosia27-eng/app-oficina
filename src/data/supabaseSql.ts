export const SUPABASE_SETUP_SQL = `-- ============================================================================
-- OficinaPro — Script SQL Completo (Tabelas + RLS + Storage)
-- Cole e execute este script no SQL Editor do seu projeto Supabase.
-- ============================================================================

-- Extensão para geração de UUIDs
create extension if not exists "pgcrypto";

-- 1. Tabela de Perfil da Oficina (tela "Minha oficina")
create table if not exists public.oficinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null default '',
  logo_url text,
  telefone text not null default '',
  email text not null default '',
  endereco text not null default '',
  cnpj_cpf text,
  atualizado_em timestamptz not null default now()
);

-- 2. Tabela de Clientes
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  telefone text not null default '',
  email text not null default ''
);

-- 3. Tabela de Veículos
create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  placa text not null,
  marca text not null default '',
  modelo text not null,
  ano integer not null default 2020,
  km integer not null default 0
);

-- 4. Tabela de Orçamentos
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'em_servico', 'finalizado')),
  desconto numeric(12, 2) not null default 0,
  validade_dias integer not null default 7,
  observacoes text not null default '',
  criado_em timestamptz not null default now()
);

-- 5. Tabela de Itens do Orçamento
create table if not exists public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  area_do_carro text not null default 'geral',
  defeito text not null default '',
  descricao text not null,
  tipo text not null check (tipo in ('peca', 'mao_de_obra')),
  quantidade numeric(10, 2) not null default 1,
  valor_unitario numeric(12, 2) not null default 0
);

-- 6. Tabela de Fornecedores
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  telefone text not null default '',
  especialidade text not null default ''
);

-- 7. Tabela de Serviços Padrão
create table if not exists public.servicos_padrao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric(12, 2) not null default 0
);

-- Índices para buscas rápidas (placa, cliente, orçamento)
create index if not exists idx_clientes_user on public.clientes(user_id);
create index if not exists idx_veiculos_user_placa on public.veiculos(user_id, placa);
create index if not exists idx_veiculos_cliente on public.veiculos(cliente_id);
create index if not exists idx_orcamentos_user_criado on public.orcamentos(user_id, criado_em desc);
create index if not exists idx_orcamentos_veiculo on public.orcamentos(veiculo_id);
create index if not exists idx_orcamento_itens_orcamento on public.orcamento_itens(orcamento_id);
create index if not exists idx_fornecedores_user on public.fornecedores(user_id);
create index if not exists idx_servicos_padrao_user on public.servicos_padrao(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — Cada mecânico só acessa os próprios dados
-- ============================================================================

alter table public.oficinas enable row level security;
alter table public.clientes enable row level security;
alter table public.veiculos enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;
alter table public.fornecedores enable row level security;
alter table public.servicos_padrao enable row level security;

-- Políticas: oficinas
drop policy if exists "oficinas_select_own" on public.oficinas;
create policy "oficinas_select_own" on public.oficinas
  for select using (auth.uid() = user_id);
drop policy if exists "oficinas_insert_own" on public.oficinas;
create policy "oficinas_insert_own" on public.oficinas
  for insert with check (auth.uid() = user_id);
drop policy if exists "oficinas_update_own" on public.oficinas;
create policy "oficinas_update_own" on public.oficinas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "oficinas_delete_own" on public.oficinas;
create policy "oficinas_delete_own" on public.oficinas
  for delete using (auth.uid() = user_id);

-- Políticas: clientes
drop policy if exists "clientes_select_own" on public.clientes;
create policy "clientes_select_own" on public.clientes
  for select using (auth.uid() = user_id);
drop policy if exists "clientes_insert_own" on public.clientes;
create policy "clientes_insert_own" on public.clientes
  for insert with check (auth.uid() = user_id);
drop policy if exists "clientes_update_own" on public.clientes;
create policy "clientes_update_own" on public.clientes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "clientes_delete_own" on public.clientes;
create policy "clientes_delete_own" on public.clientes
  for delete using (auth.uid() = user_id);

-- Políticas: veiculos
drop policy if exists "veiculos_select_own" on public.veiculos;
create policy "veiculos_select_own" on public.veiculos
  for select using (auth.uid() = user_id);
drop policy if exists "veiculos_insert_own" on public.veiculos;
create policy "veiculos_insert_own" on public.veiculos
  for insert with check (auth.uid() = user_id);
drop policy if exists "veiculos_update_own" on public.veiculos;
create policy "veiculos_update_own" on public.veiculos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "veiculos_delete_own" on public.veiculos;
create policy "veiculos_delete_own" on public.veiculos
  for delete using (auth.uid() = user_id);

-- Políticas: orcamentos
drop policy if exists "orcamentos_select_own" on public.orcamentos;
create policy "orcamentos_select_own" on public.orcamentos
  for select using (auth.uid() = user_id);
drop policy if exists "orcamentos_insert_own" on public.orcamentos;
create policy "orcamentos_insert_own" on public.orcamentos
  for insert with check (auth.uid() = user_id);
drop policy if exists "orcamentos_update_own" on public.orcamentos;
create policy "orcamentos_update_own" on public.orcamentos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "orcamentos_delete_own" on public.orcamentos;
create policy "orcamentos_delete_own" on public.orcamentos
  for delete using (auth.uid() = user_id);

-- Políticas: orcamento_itens (vinculado ao dono do orçamento)
drop policy if exists "orcamento_itens_select_own" on public.orcamento_itens;
create policy "orcamento_itens_select_own" on public.orcamento_itens
  for select using (
    exists (
      select 1 from public.orcamentos o
      where o.id = orcamento_itens.orcamento_id and o.user_id = auth.uid()
    )
  );
drop policy if exists "orcamento_itens_insert_own" on public.orcamento_itens;
create policy "orcamento_itens_insert_own" on public.orcamento_itens
  for insert with check (
    exists (
      select 1 from public.orcamentos o
      where o.id = orcamento_itens.orcamento_id and o.user_id = auth.uid()
    )
  );
drop policy if exists "orcamento_itens_update_own" on public.orcamento_itens;
create policy "orcamento_itens_update_own" on public.orcamento_itens
  for update using (
    exists (
      select 1 from public.orcamentos o
      where o.id = orcamento_itens.orcamento_id and o.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.orcamentos o
      where o.id = orcamento_itens.orcamento_id and o.user_id = auth.uid()
    )
  );
drop policy if exists "orcamento_itens_delete_own" on public.orcamento_itens;
create policy "orcamento_itens_delete_own" on public.orcamento_itens
  for delete using (
    exists (
      select 1 from public.orcamentos o
      where o.id = orcamento_itens.orcamento_id and o.user_id = auth.uid()
    )
  );

-- Políticas: fornecedores
drop policy if exists "fornecedores_select_own" on public.fornecedores;
create policy "fornecedores_select_own" on public.fornecedores
  for select using (auth.uid() = user_id);
drop policy if exists "fornecedores_insert_own" on public.fornecedores;
create policy "fornecedores_insert_own" on public.fornecedores
  for insert with check (auth.uid() = user_id);
drop policy if exists "fornecedores_update_own" on public.fornecedores;
create policy "fornecedores_update_own" on public.fornecedores
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "fornecedores_delete_own" on public.fornecedores;
create policy "fornecedores_delete_own" on public.fornecedores
  for delete using (auth.uid() = user_id);

-- Políticas: servicos_padrao
drop policy if exists "servicos_padrao_select_own" on public.servicos_padrao;
create policy "servicos_padrao_select_own" on public.servicos_padrao
  for select using (auth.uid() = user_id);
drop policy if exists "servicos_padrao_insert_own" on public.servicos_padrao;
create policy "servicos_padrao_insert_own" on public.servicos_padrao
  for insert with check (auth.uid() = user_id);
drop policy if exists "servicos_padrao_update_own" on public.servicos_padrao;
create policy "servicos_padrao_update_own" on public.servicos_padrao
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "servicos_padrao_delete_own" on public.servicos_padrao;
create policy "servicos_padrao_delete_own" on public.servicos_padrao
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- STORAGE — Bucket "logos" (limite de 1 MB para plano gratuito)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = 1048576,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Leitura pública das logos (para exibição e geração de PDF)
drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

-- Upload/edição/exclusão apenas na pasta do próprio usuário (user_id/...)
drop policy if exists "logos_insert_own" on storage.objects;
create policy "logos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "logos_update_own" on storage.objects;
create policy "logos_update_own" on storage.objects
  for update using (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "logos_delete_own" on storage.objects;
create policy "logos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
`;
