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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
