import { NextResponse } from 'next/server';
import { validarEstoquePorCategoria, type CategoriaTipoGrade } from '@/config/grades-tamanho';
import { requireActiveAdmin } from '@/lib/admin-auth';
import type { EstoqueProdutoInsert, ProdutoInsert } from '@/lib/supabase-admin';

const TYPES = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const PUBLICOS = new Set(['Masculino', 'Feminino', 'Infantil', 'Unissex']);

function text(data: FormData, key: string, required = false) {
  const value = String(data.get(key) ?? '').trim();
  if (required && !value) throw new Error(`${key === 'nome' ? 'Nome' : key} é obrigatório.`);
  return value;
}
function id(data: FormData, key: string) {
  const value = Number(data.get(key));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${key === 'categoria_id' ? 'Categoria' : 'Marca'} é obrigatória.`);
  return value;
}
function bool(data: FormData, key: string, fallback = false) {
  const value = data.get(key); return value === null ? fallback : value === 'true';
}
function price(data: FormData, key: string, required: boolean) {
  const raw = text(data, key);
  if (!raw && !required) return null;
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) throw new Error('Preço inválido.');
  return value;
}
function stock(data: FormData) {
  let parsed: { tamanho: string; quantidade: number }[] = [];
  try { parsed = JSON.parse(text(data, 'estoques')); } catch { throw new Error('Estoque inválido.'); }
  if (!Array.isArray(parsed)) throw new Error('Estoque inválido.');
  return parsed;
}
function files(data: FormData) {
  const result = data.getAll('imagens').filter((file): file is File => file instanceof File && file.size > 0);
  if (!result.length) throw new Error('Adicione pelo menos uma foto.');
  if (result.length > 10) throw new Error('A galeria aceita até 10 fotos.');
  return result.map((file) => {
    const extension = TYPES.get(file.type);
    if (!extension) throw new Error('As fotos devem ser JPG, PNG ou WebP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Cada foto deve ter no máximo 5 MB.');
    return { file, extension };
  });
}

export async function GET(request: Request) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(params.get('pageSize')) || 10));
  let query = auth.supabaseAdmin.from('produtos').select('*', { count: 'exact' });
  const search = params.get('search')?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, (match) => `\\${match}`);
    query = query.or(`codigo_produto.ilike.%${escaped}%,nome.ilike.%${escaped}%,categoria.ilike.%${escaped}%,marca.ilike.%${escaped}%`);
  }
  if (params.get('promotion') === 'promocao') query = query.eq('em_promocao', true);
  const { data: products, count, error } = await query.order('id', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const productIds = (products ?? []).map((p) => p.id);
  const [{ data: stocks }, { data: images }] = productIds.length ? await Promise.all([
    auth.supabaseAdmin.from('estoque_produtos').select('*').in('produto_id', productIds).order('id'),
    auth.supabaseAdmin.from('produto_imagens').select('*').in('produto_id', productIds).order('ordem'),
  ]) : [{ data: [] }, { data: [] }];
  return NextResponse.json({
    products: (products ?? []).map((product) => ({
      ...product,
      estoque: (stocks ?? []).filter((item) => item.produto_id === product.id),
      imagens: (images ?? []).filter((item) => item.produto_id === product.id),
    })),
    total: count ?? 0, page, pageSize,
  });
}

export async function POST(request: Request) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const uploaded: string[] = [];
  let productId: number | null = null;
  try {
    const data = await request.formData();
    const nome = text(data, 'nome', true);
    const categoriaId = id(data, 'categoria_id');
    const publico = text(data, 'publico', true);
    if (!PUBLICOS.has(publico)) throw new Error('Público inválido.');
    const preco = price(data, 'preco', true) as number;
    const emPromocao = bool(data, 'em_promocao');
    const precoPromocional = price(data, 'preco_promocional', false);
    if (emPromocao && (precoPromocional === null || precoPromocional >= preco)) throw new Error('O preço promocional deve ser menor que o preço normal.');
    const gallery = files(data);
    const { data: category } = await auth.supabaseAdmin.from('categorias').select('id,nome,tipo_grade').eq('id', categoriaId).eq('ativo', true).maybeSingle();
    if (!category) throw new Error('Categoria inválida ou inativa.');
    let marcaId = Number(data.get('marca_id')) || null;
    if (!marcaId) {
      const { data: fallback } = await auth.supabaseAdmin.from('marcas').select('id').ilike('nome', 'Indefinida').single();
      marcaId = fallback?.id ?? null;
    }
    const { data: brand } = marcaId ? await auth.supabaseAdmin.from('marcas').select('id,nome').eq('id', marcaId).eq('ativo', true).maybeSingle() : { data: null };
    if (!brand) throw new Error('Marca inválida e a marca padrão não foi encontrada.');
    const normalizedStock = validarEstoquePorCategoria(stock(data), category.tipo_grade as CategoriaTipoGrade);
    const codigo = `P${Date.now().toString(36).toUpperCase()}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const payload: ProdutoInsert = {
      codigo_produto: codigo, nome, publico, categoria_id: category.id, categoria: category.nome,
      departamento_id: null, departamento: category.nome, marca_id: brand.id, marca: brand.nome,
      preco, em_promocao: emPromocao, preco_promocional: emPromocao ? precoPromocional : null,
      ativo: bool(data, 'ativo', true), destaque: false, descricao: text(data, 'descricao') || null, imagem_principal: null,
    };
    const { data: product, error: productError } = await auth.supabaseAdmin.from('produtos').insert(payload).select().single();
    if (productError || !product) throw new Error(productError?.message ?? 'Erro ao criar produto.');
    productId = product.id;
    const rows = [];
    for (let index = 0; index < gallery.length; index++) {
      const { file, extension } = gallery[index];
      const path = `${product.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await auth.supabaseAdmin.storage.from('produtos').upload(path, file, { contentType: file.type });
      if (error) throw new Error(`Erro ao enviar foto: ${error.message}`);
      uploaded.push(path);
      const { data: publicData } = auth.supabaseAdmin.storage.from('produtos').getPublicUrl(path);
      rows.push({ produto_id: product.id, tipo_midia: 'imagem' as const, url: publicData.publicUrl, storage_path: path, ordem: index, principal: index === 0 });
    }
    const { error: imageError } = await auth.supabaseAdmin.from('produto_imagens').insert(rows);
    if (imageError) throw new Error(imageError.message);
    const stockRows: EstoqueProdutoInsert[] = normalizedStock.map((item) => ({ produto_id: product.id, tamanho: item.tamanho, quantidade: item.quantidade }));
    const { error: stockError } = await auth.supabaseAdmin.from('estoque_produtos').insert(stockRows);
    if (stockError) throw new Error(stockError.message);
    await auth.supabaseAdmin.from('produtos').update({ imagem_principal: rows[0].url }).eq('id', product.id);
    return NextResponse.json({ product: { ...product, imagem_principal: rows[0].url, imagens: rows, estoque: stockRows } }, { status: 201 });
  } catch (error) {
    if (uploaded.length) await auth.supabaseAdmin.storage.from('produtos').remove(uploaded);
    if (productId) await auth.supabaseAdmin.from('produtos').delete().eq('id', productId);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao cadastrar produto.' }, { status: 400 });
  }
}
