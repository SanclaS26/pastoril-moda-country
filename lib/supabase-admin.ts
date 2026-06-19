import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AdminUserRow = {
  id: number;
  user_id: string;
  nome: string;
  email: string;
  ativo: boolean;
  created_at?: string;
};

type AdminUserInsert = {
  user_id: string;
  nome: string;
  email: string;
  ativo: boolean;
};

export type ProdutoRow = {
  id: number;
  codigo_produto: string;
  nome: string;
  departamento_id: number | null;
  categoria_id: number | null;
  departamento: string;
  categoria: string;
  publico: string | null;
  marca: string | null;
  preco: number;
  preco_promocional: number | null;
  em_promocao: boolean;
  descricao: string | null;
  imagem_principal: string | null;
  ativo: boolean;
  destaque: boolean;
};

export type ProdutoInsert = {
  codigo_produto: string;
  nome: string;
  departamento_id?: number | null;
  categoria_id?: number | null;
  departamento: string;
  categoria: string;
  publico?: string | null;
  marca?: string | null;
  preco: number;
  preco_promocional?: number | null;
  em_promocao?: boolean;
  descricao?: string | null;
  imagem_principal?: string | null;
  ativo: boolean;
  destaque: boolean;
};

export type ProdutoUpdate = Partial<ProdutoInsert>;

export type EstoqueProdutoRow = {
  id: number;
  produto_id: number;
  tamanho: string;
  quantidade: number;
};

export type EstoqueProdutoInsert = {
  produto_id: number;
  tamanho: string;
  quantidade: number;
};

export type BannerRow = {
  id: string;
  titulo: string | null;
  imagem_url: string;
  imagem_path: string;
  imagem_desktop_url: string | null;
  imagem_desktop_path: string | null;
  imagem_mobile_url: string | null;
  imagem_mobile_path: string | null;
  ativo: boolean;
  principal: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BannerInsert = {
  titulo?: string | null;
  imagem_url: string;
  imagem_path: string;
  imagem_desktop_url?: string | null;
  imagem_desktop_path?: string | null;
  imagem_mobile_url?: string | null;
  imagem_mobile_path?: string | null;
  ativo: boolean;
  principal: boolean;
};

export type BannerUpdate = Partial<BannerInsert>;

export type DepartamentoRow = {
  id: number;
  nome: string;
  ativo: boolean;
  ordem: number | null;
  created_at?: string;
  updated_at?: string;
};

export type CategoriaRow = {
  id: number;
  departamento_id: number;
  nome: string;
  ativo: boolean;
  ordem: number | null;
  created_at?: string;
  updated_at?: string;
};

export type SiteVisitRow = {
  id: string;
  visitor_id: string;
  session_id: string;
  pathname: string;
  created_at: string;
};

export type SiteVisitInsert = {
  visitor_id: string;
  session_id: string;
  pathname: string;
  created_at?: string;
};

export type ClienteRow = {
  id: number | string;
  auth_user_id: string;
  nome: string;
  cpf: string;
  celular: string;
  email: string | null;
  endereco_completo: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ClienteInsert = {
  auth_user_id: string;
  nome: string;
  cpf: string;
  celular: string;
  email?: string | null;
  endereco_completo?: string | null;
};

export type ClienteUpdate = Partial<Omit<ClienteInsert, 'auth_user_id'>>;

export type VendaStatus = 'em_aberto' | 'concluida' | 'cancelada';
export type VendaTipo = 'carrinho' | 'pedido_whatsapp';

export type VendaRow = {
  id: string;
  codigo: string;
  tipo: VendaTipo;
  status: VendaStatus;
  cliente_auth_user_id: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  cliente_celular: string | null;
  session_id: string | null;
  telefone_whatsapp: string | null;
  total_original: number;
  total_final: number | null;
  observacoes_admin: string | null;
  whatsapp_enviado_em: string | null;
  estoque_baixado: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VendaInsert = Omit<VendaRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'> & {
  deleted_at?: string | null;
  deleted_by?: string | null;
};
export type VendaUpdate = Partial<Omit<VendaInsert, 'codigo'>>;

export type VendaItemRow = {
  id: string;
  venda_id: string;
  produto_id: number;
  estoque_produto_id: number | null;
  codigo_produto: string;
  nome: string;
  tamanho: string;
  quantidade_original: number;
  quantidade_final: number;
  valor_unitario_original: number;
  valor_unitario_final: number;
  created_at: string;
  updated_at: string;
};

export type VendaItemInsert = Omit<VendaItemRow, 'id' | 'created_at' | 'updated_at'>;
export type VendaItemUpdate = Partial<Omit<VendaItemInsert, 'venda_id' | 'produto_id'>>;

export type VendaEstoqueMovimentoInsert = {
  venda_id: string;
  produto_id: number;
  estoque_produto_id?: number | null;
  tamanho: string;
  quantidade: number;
  tipo: 'baixa' | 'restauracao';
};

type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: AdminUserRow;
        Insert: AdminUserInsert;
        Update: Partial<AdminUserInsert>;
        Relationships: [];
      };
      produtos: {
        Row: ProdutoRow;
        Insert: ProdutoInsert;
        Update: ProdutoUpdate;
        Relationships: [];
      };
      estoque_produtos: {
        Row: EstoqueProdutoRow;
        Insert: EstoqueProdutoInsert;
        Update: Partial<EstoqueProdutoInsert>;
        Relationships: [];
      };
      banners: {
        Row: BannerRow;
        Insert: BannerInsert;
        Update: BannerUpdate;
        Relationships: [];
      };
      departamentos: {
        Row: DepartamentoRow;
        Insert: Omit<DepartamentoRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DepartamentoRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      categorias: {
        Row: CategoriaRow;
        Insert: Omit<CategoriaRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CategoriaRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      site_visits: {
        Row: SiteVisitRow;
        Insert: SiteVisitInsert;
        Update: never;
        Relationships: [];
      };
      clientes: {
        Row: ClienteRow;
        Insert: ClienteInsert;
        Update: ClienteUpdate;
        Relationships: [];
      };
      vendas: {
        Row: VendaRow;
        Insert: VendaInsert;
        Update: VendaUpdate;
        Relationships: [];
      };
      venda_itens: {
        Row: VendaItemRow;
        Insert: VendaItemInsert;
        Update: VendaItemUpdate;
        Relationships: [];
      };
      venda_estoque_movimentos: {
        Row: {
          id: string;
          venda_id: string;
          produto_id: number;
          estoque_produto_id: number | null;
          tamanho: string;
          quantidade: number;
          tipo: 'baixa' | 'restauracao';
          created_at: string;
        };
        Insert: VendaEstoqueMovimentoInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      excluir_carrinho_em_aberto: {
        Args: {
          p_codigo: string;
          p_session_id?: string | null;
          p_cliente_auth_user_id?: string | null;
        };
        Returns: boolean;
      };
      excluir_carrinhos_expirados: {
        Args: {
          p_expira_antes?: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let supabaseAdmin: SupabaseClient<Database> | null = null;

export class SupabaseAdminConfigError extends Error {}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new SupabaseAdminConfigError(
      'Variavel de ambiente ausente: configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.'
    );
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}
