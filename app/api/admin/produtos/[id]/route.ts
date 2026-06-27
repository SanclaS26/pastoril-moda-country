import { NextResponse } from 'next/server';
import { validarEstoquePorCategoria, type CategoriaTipoGrade } from '@/config/grades-tamanho';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type Context = { params: Promise<{ id: string }> };
type Stock = { id?: number; tamanho: string; quantidade: number };
type GalleryToken = { id?: number; newIndex?: number };
const TYPES = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const PUBLICOS = new Set(['Masculino', 'Feminino', 'Infantil', 'Unissex']);
const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const flag = (data: FormData, key: string, fallback = false) => data.get(key) === null ? fallback : data.get(key) === 'true';

async function fullProduct(auth: ReturnType<typeof getSupabaseAdmin>, id: number) {
  const { data: product } = await auth.from('produtos').select('*').eq('id', id).maybeSingle();
  if (!product) return null;
  const [{ data: estoque }, { data: imagens }] = await Promise.all([
    auth.from('estoque_produtos').select('*').eq('produto_id', id).order('id'),
    auth.from('produto_imagens').select('*').eq('produto_id', id).order('ordem'),
  ]);
  return { ...product, estoque: estoque ?? [], imagens: imagens ?? [] };
}

export async function GET(request: Request, { params }: Context) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const product = await fullProduct(auth.supabaseAdmin, Number((await params).id));
  return product ? NextResponse.json({ product }) : NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const productId = Number((await params).id);
  const uploaded: string[] = [];
  try {
    const current = await fullProduct(auth.supabaseAdmin, productId);
    if (!current) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    const data = await request.formData();
    const nome = value(data, 'nome');
    const publico = value(data, 'publico');
    const categoriaId = Number(data.get('categoria_id'));
    if (!nome || !PUBLICOS.has(publico) || !Number.isInteger(categoriaId)) throw new Error('Nome, público e categoria são obrigatórios.');
    const preco = Number(value(data, 'preco').replace(',', '.'));
    const emPromocao = flag(data, 'em_promocao');
    const promoRaw = value(data, 'preco_promocional');
    const promocional = promoRaw ? Number(promoRaw.replace(',', '.')) : null;
    if (!Number.isFinite(preco) || preco < 0) throw new Error('Preço inválido.');
    if (emPromocao && (promocional === null || promocional >= preco)) throw new Error('O preço promocional deve ser menor que o preço normal.');
    const { data: category } = await auth.supabaseAdmin.from('categorias').select('id,nome,tipo_grade').eq('id', categoriaId).eq('ativo', true).maybeSingle();
    if (!category) throw new Error('Categoria inválida ou inativa.');
    let brandId = Number(data.get('marca_id')) || null;
    if (!brandId) {
      const { data: fallback } = await auth.supabaseAdmin.from('marcas').select('id').ilike('nome', 'Indefinida').single();
      brandId = fallback?.id ?? null;
    }
    const { data: brand } = brandId ? await auth.supabaseAdmin.from('marcas').select('id,nome').eq('id', brandId).eq('ativo', true).maybeSingle() : { data: null };
    if (!brand) throw new Error('Marca inválida.');
    let stocks: Stock[];
    try { stocks = JSON.parse(value(data, 'estoques')); } catch { throw new Error('Estoque inválido.'); }
    stocks = validarEstoquePorCategoria(stocks, category.tipo_grade as CategoriaTipoGrade);
    let order: GalleryToken[];
    try { order = JSON.parse(value(data, 'gallery_order')); } catch { throw new Error('Ordem da galeria inválida.'); }
    if (!Array.isArray(order) || !order.length || order.length > 10) throw new Error('A galeria deve conter de 1 a 10 fotos.');
    const newFiles = data.getAll('imagens').filter((item): item is File => item instanceof File && item.size > 0);
    const currentById = new Map(current.imagens.map((image) => [image.id, image]));
    const finalRows: { id?: number; url: string; storage_path: string | null; ordem: number; principal: boolean }[] = [];
    for (let index = 0; index < order.length; index++) {
      const token = order[index];
      if (token.id) {
        const image = currentById.get(token.id);
        if (!image) throw new Error('Foto existente inválida.');
        finalRows.push({ id: image.id, url: image.url, storage_path: image.storage_path, ordem: index, principal: index === 0 });
      } else {
        const file = newFiles[token.newIndex ?? -1];
        const extension = file && TYPES.get(file.type);
        if (!file || !extension || file.size > 5 * 1024 * 1024) throw new Error('Nova foto inválida.');
        const path = `${productId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await auth.supabaseAdmin.storage.from('produtos').upload(path, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        uploaded.push(path);
        const { data: publicData } = auth.supabaseAdmin.storage.from('produtos').getPublicUrl(path);
        finalRows.push({ url: publicData.publicUrl, storage_path: path, ordem: index, principal: index === 0 });
      }
    }
    const keptIds = new Set(finalRows.flatMap((row) => row.id ? [row.id] : []));
    const removed = current.imagens.filter((image) => !keptIds.has(image.id));
    const { error: galleryError } = await auth.supabaseAdmin.rpc('sincronizar_produto_imagens', {
      p_produto_id: productId,
      p_imagens: finalRows.map((row) => ({
        tipo_midia: 'imagem' as const,
        url: row.url,
        storage_path: row.storage_path,
      })),
    });
    if (galleryError) throw new Error(`Erro ao sincronizar galeria: ${galleryError.message}`);
    const { error: updateError } = await auth.supabaseAdmin.from('produtos').update({
      nome, publico, categoria_id: category.id, categoria: category.nome, departamento: category.nome, departamento_id: null,
      marca_id: brand.id, marca: brand.nome, preco, em_promocao: emPromocao,
      preco_promocional: emPromocao ? promocional : null, ativo: flag(data, 'ativo', true),
      descricao: value(data, 'descricao') || null, imagem_principal: finalRows[0].url,
    }).eq('id', productId);
    if (updateError) throw new Error(updateError.message);
    await auth.supabaseAdmin.from('estoque_produtos').delete().eq('produto_id', productId);
    const { error: stockError } = await auth.supabaseAdmin.from('estoque_produtos').insert(stocks.map((item) => ({ produto_id: productId, tamanho: item.tamanho, quantidade: item.quantidade })));
    if (stockError) throw new Error(stockError.message);
    const removedPaths = removed.flatMap((image) => image.storage_path ? [image.storage_path] : []);
    if (removedPaths.length) await auth.supabaseAdmin.storage.from('produtos').remove(removedPaths);
    return NextResponse.json({ product: await fullProduct(auth.supabaseAdmin, productId) });
  } catch (error) {
    if (uploaded.length) await auth.supabaseAdmin.storage.from('produtos').remove(uploaded);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao editar produto.' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const { error } = await auth.supabaseAdmin.from('produtos').update({ ativo: false }).eq('id', Number((await params).id));
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ success: true });
}
