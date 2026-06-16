import { NextResponse } from 'next/server';
import { validarEstoqueParaGrade } from '@/config/grades-tamanho';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin, type EstoqueProdutoInsert, type EstoqueProdutoRow, type ProdutoInsert, type ProdutoRow } from '@/lib/supabase-admin';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

type StockInput = {
  id?: number;
  tamanho: string;
  quantidade: number;
};

type ProductWithStock = ProdutoRow & {
  estoque: EstoqueProdutoRow[];
};

function parseBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null) return fallback;
  return value === 'true' || value === '1' || value === 'on';
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseRequiredString(value: FormDataEntryValue | null, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} é obrigatório.`);
  }

  return value.trim();
}

function parsePrice(value: FormDataEntryValue | null, field: string, required: boolean) {
  if (typeof value !== 'string' || !value.trim()) {
    if (required) {
      throw new Error(`${field} é obrigatório.`);
    }

    return null;
  }

  const price = Number(value.replace(',', '.'));

  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`${field} deve ser maior ou igual a zero.`);
  }

  return price;
}

function validatePromotion(emPromocao: boolean, preco: number, precoPromocional: number | null) {
  if (!emPromocao) {
    return null;
  }

  if (precoPromocional === null) {
    throw new Error('Preço promocional é obrigatório para produto em promoção.');
  }

  if (precoPromocional >= preco) {
    throw new Error('Preço promocional deve ser menor que o preço normal.');
  }

  return precoPromocional;
}

function parseStock(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  let stock: StockInput[];

  try {
    stock = JSON.parse(value);
  } catch {
    throw new Error('Estoque inválido.');
  }

  if (!Array.isArray(stock)) {
    throw new Error('Estoque inválido.');
  }

  const sizes = new Set<string>();

  return stock.map((item) => {
    const tamanho = String(item?.tamanho ?? '').trim();
    const quantidade = Number(item?.quantidade ?? 0);
    const sizeKey = tamanho.toLowerCase();

    if (!tamanho) {
      throw new Error('Informe o tamanho em todas as linhas de estoque.');
    }

    if (sizes.has(sizeKey)) {
      throw new Error('Não repita o mesmo tamanho no estoque do produto.');
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new Error('A quantidade em estoque deve ser maior que zero.');
    }

    sizes.add(sizeKey);
    return {
      id: Number.isInteger(Number(item?.id)) ? Number(item.id) : undefined,
      tamanho,
      quantidade,
    };
  });
}

function validateImage(file: File | null, required: boolean) {
  if (!file || file.size === 0) {
    if (required) {
      throw new Error('A foto do produto é obrigatória.');
    }

    return null;
  }

  const extension = ALLOWED_IMAGE_TYPES.get(file.type);

  if (!extension) {
    throw new Error('A imagem deve ser JPG, PNG ou WebP.');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('A imagem deve ter no máximo 5 MB.');
  }

  return extension;
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function formatProduct(product: ProdutoRow, stock: EstoqueProdutoRow[]): ProductWithStock {
  return {
    ...product,
    estoque: stock,
  };
}

async function listProducts(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const { data: products, error: productsError } = await supabaseAdmin
    .from('produtos')
    .select('*')
    .order('id', { ascending: false });

  if (productsError) {
    throw new Error(`Erro ao listar produtos: ${productsError.message}`);
  }

  if (!products?.length) {
    return [];
  }

  const productIds = products.map((product) => product.id);
  const { data: stock, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('*')
    .in('produto_id', productIds)
    .order('id', { ascending: true });

  if (stockError) {
    throw new Error(`Erro ao listar estoque dos produtos: ${stockError.message}`);
  }

  return products.map((product) =>
    formatProduct(product, (stock ?? []).filter((item) => item.produto_id === product.id))
  );
}

export async function GET(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const products = await listProducts(authorization.supabaseAdmin);
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao listar produtos.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { supabaseAdmin } = authorization;
  let uploadedPath: string | null = null;
  let createdProductId: number | null = null;

  try {
    const formData = await request.formData();
    const codigoProduto = parseRequiredString(formData.get('codigo_produto'), 'Código da peça');
    const nome = parseRequiredString(formData.get('nome'), 'Nome');
    const departamento = parseRequiredString(formData.get('departamento'), 'Departamento');
    const categoria = parseRequiredString(formData.get('categoria'), 'Categoria');
    const preco = parsePrice(formData.get('preco'), 'Preço', true);
    const precoPromocional = parsePrice(formData.get('preco_promocional'), 'Preço promocional', false);
    const emPromocao = parseBoolean(formData.get('em_promocao'), false);
    const validatedPromotionalPrice = validatePromotion(emPromocao, preco ?? 0, precoPromocional);
    const publico = parseOptionalString(formData.get('publico'));
    const stock = validarEstoqueParaGrade(parseStock(formData.get('estoques') ?? formData.get('estoque')), departamento, publico);
    const imageFile = formData.get('imagem');
    const image = imageFile instanceof File ? imageFile : null;
    const extension = validateImage(image, true);

    if (!stock.length) {
      throw new Error('Adicione pelo menos um tamanho ao produto.');
    }

    const { data: existingProduct, error: existingError } = await supabaseAdmin
      .from('produtos')
      .select('id')
      .eq('codigo_produto', codigoProduto)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: `Erro ao verificar código do produto: ${existingError.message}` }, { status: 500 });
    }

    if (existingProduct) {
      return NextResponse.json({ error: 'Já existe um produto com este código da peça.' }, { status: 409 });
    }

    const productPayload: ProdutoInsert = {
      codigo_produto: codigoProduto,
      nome,
      departamento,
      categoria,
      publico,
      marca: parseOptionalString(formData.get('marca')),
      preco: preco ?? 0,
      preco_promocional: validatedPromotionalPrice,
      em_promocao: emPromocao,
      descricao: parseOptionalString(formData.get('descricao')),
      imagem_principal: null,
      ativo: parseBoolean(formData.get('ativo'), true),
      destaque: parseBoolean(formData.get('destaque'), false),
    };

    const { data: createdProduct, error: insertProductError } = await supabaseAdmin
      .from('produtos')
      .insert([productPayload])
      .select('*')
      .single();

    if (insertProductError || !createdProduct) {
      return NextResponse.json(
        { error: `Erro ao cadastrar produto: ${insertProductError?.message ?? 'produto não retornado.'}` },
        { status: 500 }
      );
    }

    createdProductId = createdProduct.id;
    const fileName = `${sanitizeFileName(nome || codigoProduto)}-${crypto.randomUUID()}.${extension}`;
    uploadedPath = `${createdProduct.id}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('produtos')
      .upload(uploadedPath, image as File, {
        contentType: image?.type,
        upsert: false,
      });

    if (uploadError) {
      await supabaseAdmin.from('produtos').delete().eq('id', createdProduct.id);
      return NextResponse.json({ error: `Erro ao enviar foto do produto: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('produtos').getPublicUrl(uploadedPath);
    const { data: updatedProduct, error: updateImageError } = await supabaseAdmin
      .from('produtos')
      .update({ imagem_principal: publicUrlData.publicUrl })
      .eq('id', createdProduct.id)
      .select('*')
      .single();

    if (updateImageError || !updatedProduct) {
      await supabaseAdmin.storage.from('produtos').remove([uploadedPath]);
      await supabaseAdmin.from('produtos').delete().eq('id', createdProduct.id);
      return NextResponse.json(
        { error: `Erro ao salvar URL da foto: ${updateImageError?.message ?? 'produto não retornado.'}` },
        { status: 500 }
      );
    }

    const stockPayload: EstoqueProdutoInsert[] = stock.map((item) => ({
      produto_id: createdProduct.id,
      tamanho: item.tamanho,
      quantidade: item.quantidade,
    }));

    const { error: insertStockError } = await supabaseAdmin.from('estoque_produtos').insert(stockPayload);

    if (insertStockError) {
      await supabaseAdmin.storage.from('produtos').remove([uploadedPath]);
      await supabaseAdmin.from('estoque_produtos').delete().eq('produto_id', createdProduct.id);
      await supabaseAdmin.from('produtos').delete().eq('id', createdProduct.id);
      return NextResponse.json(
        { error: `Erro ao cadastrar estoque do produto: ${insertStockError.message}` },
        { status: 500 }
      );
    }

    const { data: savedStock } = await supabaseAdmin
      .from('estoque_produtos')
      .select('*')
      .eq('produto_id', createdProduct.id)
      .order('id', { ascending: true });

    return NextResponse.json({ product: formatProduct(updatedProduct, savedStock ?? []) }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      await supabaseAdmin.storage.from('produtos').remove([uploadedPath]);
    }

    if (createdProductId) {
      await supabaseAdmin.from('estoque_produtos').delete().eq('produto_id', createdProductId);
      await supabaseAdmin.from('produtos').delete().eq('id', createdProductId);
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro inesperado ao cadastrar produto.' }, { status: 500 });
  }
}
