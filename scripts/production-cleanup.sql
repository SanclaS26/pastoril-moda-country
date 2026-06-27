-- SCRIPT DESTRUTIVO - APAGA DADOS, MAS PRESERVA A ESTRUTURA.
--
-- Leia docs/production-cleanup.md e confirme o backup antes de executar.
-- Este script nao remove usuarios do Supabase Auth nem objetos do Storage.
-- Ele tambem preserva public.erp_integrations, que contem configuracao operacional.

begin;

truncate table
  public.venda_estoque_movimentos,
  public.venda_itens,
  public.vendas,
  public.itens_pedido,
  public.pedidos,
  public.wishlist_items,
  public.estoque_produtos,
  public.produtos,
  public.categorias,
  public.departamentos,
  public.banners,
  public.clientes,
  public.admin_users,
  public.site_visits,
  public.whatsapp_atendimento_sessoes
continue identity;

commit;
