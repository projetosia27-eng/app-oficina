export type OrcamentoStatus =
  | 'rascunho'
  | 'enviado'
  | 'aprovado'
  | 'em_servico'
  | 'finalizado';

export type ItemTipo = 'peca' | 'mao_de_obra';

export type AreaId =
  | 'motor'
  | 'freios'
  | 'suspensao'
  | 'direcao'
  | 'eletrica'
  | 'escapamento'
  | 'pneus'
  | 'ar_condicionado'
  | 'cambio';

export interface Oficina {
  id: string;
  user_id: string;
  nome: string;
  logo_url: string | null;
  telefone: string;
  email: string;
  endereco: string;
  cnpj_cpf: string | null;
}

export interface Cliente {
  id: string;
  user_id: string;
  nome: string;
  telefone: string;
  email: string;
}

export interface Veiculo {
  id: string;
  user_id: string;
  cliente_id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  km: number;
}

export interface Orcamento {
  id: string;
  user_id: string;
  cliente_id: string;
  veiculo_id: string;
  status: OrcamentoStatus;
  desconto: number;
  validade_dias: number;
  observacoes: string;
  criado_em: string;
  // Joins opcionais no front
  clientes?: Cliente | null;
  veiculos?: Veiculo | null;
  orcamento_itens?: OrcamentoItem[];
}

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  area_do_carro: string;
  defeito: string;
  descricao: string;
  tipo: ItemTipo;
  quantidade: number;
  valor_unitario: number;
}

export interface Fornecedor {
  id: string;
  user_id: string;
  nome: string;
  telefone: string;
  especialidade: string;
}

export interface ServicoPadrao {
  id: string;
  user_id: string;
  nome: string;
  valor: number;
}

export type AppTab =
  | 'inicio'
  | 'clientes'
  | 'fornecedores'
  | 'servicos'
  | 'oficina';
