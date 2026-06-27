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

export type ErpIntegrationRow = {
  id: number;
  erp_name: string | null;
  provider_name: string | null;
  api_base_url: string | null;
  api_version: string | null;
  environment: 'Producao' | 'Homologacao' | 'Sandbox';
  auth_type: 'API Key' | 'Bearer Token' | 'OAuth 2.0' | 'Usuario e senha' | 'Ainda nao definido';
  sync_interval_minutes: number;
  sync_products: boolean;
  sync_categories: boolean;
  sync_prices: boolean;
  sync_images: boolean;
  sync_stock: boolean;
  send_confirmed_sales: boolean;
  is_active: boolean;
  credentials_configured: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpIntegrationUpdate = Partial<
  Pick<
    ErpIntegrationRow,
    | 'erp_name'
    | 'provider_name'
    | 'api_base_url'
    | 'api_version'
    | 'environment'
    | 'auth_type'
    | 'sync_interval_minutes'
    | 'sync_products'
    | 'sync_categories'
    | 'sync_prices'
    | 'sync_images'
    | 'sync_stock'
    | 'send_confirmed_sales'
  >
>;

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
  marca_id: number | null;
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
  marca_id?: number | null;
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
  departamento_id: number | null;
  nome: string;
  slug: string;
  ativo: boolean;
  ordem: number | null;
  created_at?: string;
  updated_at?: string;
  tipo_grade: CategoriaTipoGrade;
};

export type CategoriaTipoGrade = 'roupas' | 'calcados' | 'chapeus_bones' | 'cintos' | 'unico';

export type MarcaRow = {
  id: number;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ProdutoImagemRow = {
  id: number;
  produto_id: number;
  tipo_midia: 'imagem' | 'video';
  url: string;
  storage_path: string | null;
  ordem: number;
  principal: boolean;
  created_at: string;
  updated_at: string;
};

export type SiteVisitRow = {
  city: string | null;
  country: string | null;
  id: string;
  visitor_id: string | null;
  session_id: string;
  pathname: string;
  region: string | null;
  created_at: string;
  user_id: string | null;
  visit_date: string | null;
};

export type SiteVisitInsert = {
  city?: string | null;
  country?: string | null;
  visitor_id?: string | null;
  session_id: string;
  pathname: string;
  region?: string | null;
  created_at?: string;
  user_id?: string | null;
  visit_date?: string | null;
};

export type WhatsAppPresentedProduct = {
  position: number;
  productId: number;
};

export type WhatsAppConversationState = 'idle' | 'sending_gallery' | 'awaiting_photo_number' | 'awaiting_size_preference';

export type WhatsAppAtendimentoSessaoRow = {
  id: string;
  phone: string;
  session_started_at: string;
  last_interaction_at: string;
  active_gallery_id: string | null;
  photo_selection_expires_at: string | null;
  site_notice_sent: boolean;
  awaiting_product_position: boolean;
  conversation_state: WhatsAppConversationState;
  last_category: string | null;
  pending_category: string | null;
  pending_department: string | null;
  requested_size: string | null;
  presented_products: WhatsAppPresentedProduct[];
  created_at: string;
  updated_at: string;
};

export type WhatsAppAtendimentoSessaoInsert = {
  phone: string;
  session_started_at?: string;
  last_interaction_at?: string;
  active_gallery_id?: string | null;
  photo_selection_expires_at?: string | null;
  site_notice_sent?: boolean;
  awaiting_product_position?: boolean;
  conversation_state?: WhatsAppConversationState;
  last_category?: string | null;
  pending_category?: string | null;
  pending_department?: string | null;
  requested_size?: string | null;
  presented_products?: WhatsAppPresentedProduct[];
};

export type WhatsAppAtendimentoSessaoUpdate = Partial<WhatsAppAtendimentoSessaoInsert>;

export type ClienteRow = {
  id: number | string;
  auth_user_id: string;
  nome: string;
  cpf: string;
  celular: string;
  email: string | null;
  endereco_completo: string | null;
  must_change_password: boolean;
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
  must_change_password?: boolean;
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
  concluded_at: string | null;
  first_admin_response_at: string | null;
  estoque_baixado: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VendaInsert = Omit<VendaRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by' | 'concluded_at' | 'first_admin_response_at'> & {
  deleted_at?: string | null;
  deleted_by?: string | null;
  concluded_at?: string | null;
  first_admin_response_at?: string | null;
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
      erp_integrations: {
        Row: ErpIntegrationRow;
        Insert: ErpIntegrationUpdate & { id?: number };
        Update: ErpIntegrationUpdate;
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
        Insert: Omit<CategoriaRow, 'id' | 'slug' | 'created_at' | 'updated_at'> & { slug?: string };
        Update: Partial<Omit<CategoriaRow, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      marcas: {
        Row: MarcaRow;
        Insert: Pick<MarcaRow, 'nome' | 'ativo'>;
        Update: Partial<Pick<MarcaRow, 'nome' | 'ativo'>>;
        Relationships: [];
      };
      produto_imagens: {
        Row: ProdutoImagemRow;
        Insert: Pick<ProdutoImagemRow, 'produto_id' | 'tipo_midia' | 'url' | 'storage_path' | 'ordem' | 'principal'>;
        Update: Partial<Pick<ProdutoImagemRow, 'tipo_midia' | 'url' | 'storage_path' | 'ordem' | 'principal'>>;
        Relationships: [];
      };
      site_visits: {
        Row: SiteVisitRow;
        Insert: SiteVisitInsert;
        Update: never;
        Relationships: [];
      };
      whatsapp_atendimento_sessoes: {
        Row: WhatsAppAtendimentoSessaoRow;
        Insert: WhatsAppAtendimentoSessaoInsert;
        Update: WhatsAppAtendimentoSessaoUpdate;
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
      sincronizar_produto_imagens: {
        Args: {
          p_produto_id: number;
          p_imagens: {
            tipo_midia: 'imagem' | 'video';
            url: string;
            storage_path: string | null;
          }[];
        };
        Returns: undefined;
      };
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
      concluir_venda: {
        Args: { p_venda_id: string };
        Returns: VendaRow;
      };
      cancelar_venda: {
        Args: { p_venda_id: string };
        Returns: VendaRow;
      };
      reabrir_venda: {
        Args: { p_venda_id: string };
        Returns: VendaRow;
      };
      registrar_primeira_resposta_admin: {
        Args: { p_venda_id: string };
        Returns: VendaRow;
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
