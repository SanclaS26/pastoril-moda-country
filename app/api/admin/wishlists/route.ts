import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const DB_PAGE_SIZE = 1000;
const MAX_ITEMS = 50000;
const RESPONSE_PAGE_SIZE = 20;

type WishlistRow = { created_at: string; product_id: number; user_id: string };
type ClientRow = { auth_user_id: string; email: string | null; nome: string };
type ProductRow = {
  codigo_produto: string;
  em_promocao: boolean;
  id: number;
  imagem_principal: string | null;
  nome: string;
  preco: number;
  preco_promocional: number | null;
};

async function loadWishlistRows(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const rows: WishlistRow[] = [];

  for (let from = 0; from < MAX_ITEMS; from += DB_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('wishlist_items')
      .select('user_id, product_id, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + DB_PAGE_SIZE - 1);
    if (error) throw new Error(`Erro ao carregar listas de desejos: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as WishlistRow[]));
    if (data.length < DB_PAGE_SIZE) break;
  }

  return rows;
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);
  if (authorization.response) return authorization.response;

  try {
    const params = new URL(request.url).searchParams;
    const requestedUserId = params.get('user_id')?.trim() ?? '';
    const search = params.get('search')?.trim().toLocaleLowerCase('pt-BR') ?? '';
    const sort = params.get('sort') ?? 'count';
    const page = Math.max(1, Number(params.get('page')) || 1);
    const wishlistRows = await loadWishlistRows(authorization.supabaseAdmin);
    const userIds = [...new Set(wishlistRows.map((row) => row.user_id))];
    const productIds = [...new Set(wishlistRows.map((row) => row.product_id))];

    const [clientsResult, productsResult, stockResult] = await Promise.all([
      userIds.length
        ? authorization.supabaseAdmin.from('clientes').select('auth_user_id, nome, email').in('auth_user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? authorization.supabaseAdmin.from('produtos').select('id, codigo_produto, nome, preco, preco_promocional, em_promocao, imagem_principal').in('id', productIds)
        : Promise.resolve({ data: [], error: null }),
      productIds.length
        ? authorization.supabaseAdmin.from('estoque_produtos').select('produto_id, quantidade').in('produto_id', productIds).gt('quantidade', 0)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (clientsResult.error || productsResult.error || stockResult.error) {
      throw new Error(clientsResult.error?.message || productsResult.error?.message || stockResult.error?.message || 'Erro ao carregar dados relacionados.');
    }

    const clients = clientsResult.data as ClientRow[];
    const products = productsResult.data as ProductRow[];
    const clientMap = new Map(clients.map((client) => [client.auth_user_id, client]));
    const productMap = new Map(products.map((product) => [product.id, product]));
    const availableIds = new Set((stockResult.data ?? []).map((stock) => Number(stock.produto_id)));

    if (requestedUserId) {
      const client = clientMap.get(requestedUserId) ?? null;
      const items = wishlistRows
        .filter((row) => row.user_id === requestedUserId)
        .map((row) => ({
          available: availableIds.has(row.product_id),
          createdAt: row.created_at,
          product: productMap.get(row.product_id) ?? null,
        }))
        .filter((item) => item.product !== null);
      return NextResponse.json({ client, items });
    }

    const groups = new Map<string, { client: ClientRow | null; itemCount: number; lastUpdated: string; productCodes: string[] }>();
    wishlistRows.forEach((row) => {
      const current = groups.get(row.user_id);
      const productCode = productMap.get(row.product_id)?.codigo_produto ?? '';
      if (current) {
        current.itemCount += 1;
        if (productCode) current.productCodes.push(productCode);
      } else {
        groups.set(row.user_id, {
          client: clientMap.get(row.user_id) ?? null,
          itemCount: 1,
          lastUpdated: row.created_at,
          productCodes: productCode ? [productCode] : [],
        });
      }
    });

    const summaries = [...groups.entries()]
      .map(([userId, group]) => ({ ...group, userId }))
      .filter((group) => {
        if (!search) return true;
        return (
          group.client?.nome.toLocaleLowerCase('pt-BR').includes(search) ||
          group.client?.email?.toLocaleLowerCase('pt-BR').includes(search) ||
          group.productCodes.some((code) => code.toLocaleLowerCase('pt-BR').includes(search))
        );
      })
      .sort((left, right) => {
        if (sort === 'recent') return right.lastUpdated.localeCompare(left.lastUpdated);
        if (sort === 'name') return (left.client?.nome ?? '').localeCompare(right.client?.nome ?? '', 'pt-BR');
        return right.itemCount - left.itemCount;
      });

    const productCounts = new Map<number, number>();
    wishlistRows.forEach((row) => productCounts.set(row.product_id, (productCounts.get(row.product_id) ?? 0) + 1));
    const topProducts = [...productCounts.entries()]
      .map(([id, count]) => ({ count, product: productMap.get(id) ?? null }))
      .filter((item) => item.product !== null)
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
    const start = (page - 1) * RESPONSE_PAGE_SIZE;

    return NextResponse.json({
      page,
      pageSize: RESPONSE_PAGE_SIZE,
      stats: { clientsWithFavorites: groups.size, totalItems: wishlistRows.length, topProducts },
      summaries: summaries.slice(start, start + RESPONSE_PAGE_SIZE),
      total: summaries.length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar listas de desejos.' }, { status: 500 });
  }
}
