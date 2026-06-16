import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin, type EstoqueProdutoInsert, type EstoqueProdutoRow, type ProdutoUpdate, type ProdutoRow } from '@/lib/supabase-admin';

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

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseProductId(value: string) {
  const productId = Number(value);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error('Produto inválido.');
  }

  return productId;
}

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

function validateImage(file: File | null) {
  if (!file || file.size === 0) {
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

function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/produtos/';
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(url.slice(markerIndex + marker.length));
}

function formatProduct(product: ProdutoRow, stock: EstoqueProdutoRow[]) {
  return {
    ...product,
    estoque: stock,
  };
}

async function getProductWithStock(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, productId: number) {
  const { data: product, error: productError } = await supabaseAdmin
    .from('produtos')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (productError) {
    throw new Error(`Erro ao buscar produto: ${productError.message}`);
  }

  if (!product) {
    return null;
  }

  const { data: stock, error: stockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('*')
    .eq('produto_id', productId)
    .order('id', { ascending: true });

  if (stockError) {
    throw new Error(`Erro ao buscar estoque do produto: ${stockError.message}`);
  }

  return formatProduct(product, stock ?? []);
}

async function syncStock(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  productId: number,
  stock: StockInput[],
) {
  const { data: currentStock, error: currentStockError } = await supabaseAdmin
    .from('estoque_produtos')
    .select('*')
    .eq('produto_id', productId);

  if (currentStockError) {
    throw new Error(`Erro ao buscar estoque atual: ${currentStockError.message}`);
  }

  const currentIds = new Set((currentStock ?? []).map((item) => item.id));
  const receivedExistingIds = new Set(stock.filter((item) => item.id).map((item) => item.id as number));
  const idsToDelete = [...currentIds].filter((id) => !receivedExistingIds.has(id));

  if (idsToDelete.length) {
    const { error: deleteError } = await supabaseAdmin
      .from('estoque_produtos')
      .delete()
      .eq('produto_id', productId)
      .in('id', idsToDelete);

    if (deleteError) {
      throw new Error(`Erro ao remover tamanhos do estoque: ${deleteError.message}`);
    }
  }

  for (const item of stock) {
    if (item.id && currentIds.has(item.id)) {
      const { error: updateError } = await supabaseAdmin
        .from('estoque_produtos')
        .update({ tamanho: item.tamanho, quantidade: item.quantidade })
        .eq('id', item.id)
        .eq('produto_id', productId);

      if (updateError) {
        throw new Error(`Erro ao atualizar tamanho ${item.tamanho}: ${updateError.message}`);
      }
    }
  }

  const newStock: EstoqueProdutoInsert[] = stock
    .filter((item) => !item.id || !currentIds.has(item.id))
    .map((item) => ({
      produto_id: productId,
      tamanho: item.tamanho,
      quantidade: item.quantidade,
    }));

  if (newStock.length) {
    const { error: insertError } = await supabaseAdmin.from('estoque_produtos').insert(newStock);

    if (insertError) {
      throw new Error(`Erro ao inserir novos tamanhos: ${insertError.message}`);
    }
  }
}

export async function GET(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { id } = await context.params;
    const product = await getProductWithStock(authorization.supabaseAdmin, parseProductId(id));

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao buscar produto.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  const { supabaseAdmin } = authorization;
  let uploadedPath: string | null = null;

  try {
    const { id } = await context.params;
    const productId = parseProductId(id);
    const formData = await request.formData();
    const codigoProduto = parseRequiredString(formData.get('codigo_produto'), 'Código da peça');
    const nome = parseRequiredString(formData.get('nome'), 'Nome');
    const departamento = parseRequiredString(formData.get('departamento'), 'Departamento');
    const categoria = parseRequiredString(formData.get('categoria'), 'Categoria');
    const preco = parsePrice(formData.get('preco'), 'Preço', true);
    const precoPromocional = parsePrice(formData.get('preco_promocional'), 'Preço promocional', false);
    const emPromocao = parseBoolean(formData.get('em_promocao'), false);
    const validatedPromotionalPrice = validatePromotion(emPromocao, preco ?? 0, precoPromocional);
    const stock = parseStock(formData.get('estoques') ?? formData.get('estoque'));
    const imageFile = formData.get('imagem');
    const image = imageFile instanceof File ? imageFile : null;
    const extension = validateImage(image);

    if (!stock.length) {
      throw new Error('Adicione pelo menos um tamanho ao produto.');
    }

    const { data: currentProduct, error: currentError } = await supabaseAdmin
      .from('produtos')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json({ error: `Erro ao buscar produto: ${currentError.message}` }, { status: 500 });
    }

    if (!currentProduct) {
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    }

    const { data: duplicatedProduct, error: duplicatedError } = await supabaseAdmin
      .from('produtos')
      .select('id')
      .eq('codigo_produto', codigoProduto)
      .neq('id', productId)
      .maybeSingle();

    if (duplicatedError) {
      return NextResponse.json({ error: `Erro ao verificar código do produto: ${duplicatedError.message}` }, { status: 500 });
    }

    if (duplicatedProduct) {
      return NextResponse.json({ error: 'Já existe outro produto com este código da peça.' }, { status: 409 });
    }

    let imageUrl = currentProduct.imagem_principal;

    if (image && extension) {
      const fileName = `${sanitizeFileName(nome || codigoProduto)}-${crypto.randomUUID()}.${extension}`;
      uploadedPath = `${productId}/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('produtos')
        .upload(uploadedPath, image, {
          contentType: image.type,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json({ error: `Erro ao enviar foto do produto: ${uploadError.message}` }, { status: 500 });
      }

      const { data: publicUrlData } = supabaseAdmin.storage.from('produtos').getPublicUrl(uploadedPath);
      imageUrl = publicUrlData.publicUrl;
    }

    const productPayload: ProdutoUpdate = {
      codigo_produto: codigoProduto,
      nome,
      departamento,
      categoria,
      publico: parseOptionalString(formData.get('publico')),
      marca: parseOptionalString(formData.get('marca')),
      preco: preco ?? 0,
      preco_promocional: validatedPromotionalPrice,
      em_promocao: emPromocao,
      descricao: parseOptionalString(formData.get('descricao')),
      imagem_principal: imageUrl,
      ativo: parseBoolean(formData.get('ativo'), true),
      destaque: parseBoolean(formData.get('destaque'), false),
    };

    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('produtos')
      .update(productPayload)
      .eq('id', productId)
      .select('*')
      .single();

    if (updateError || !updatedProduct) {
      if (uploadedPath) {
        await supabaseAdmin.storage.from('produtos').remove([uploadedPath]);
      }

      return NextResponse.json(
        { error: `Erro ao editar produto: ${updateError?.message ?? 'produto não retornado.'}` },
        { status: 500 }
      );
    }

    try {
      await syncStock(supabaseAdmin, productId, stock);
    } catch (stockError) {
      if (uploadedPath) {
        await supabaseAdmin.storage.from('produtos').remove([uploadedPath]);
      }

      return NextResponse.json(
        { error: stockError instanceof Error ? stockError.message : 'Erro ao sincronizar estoque.' },
        { status: 500 }
      );
    }

    if (uploadedPath) {
      const previousPath = storagePathFromPublicUrl(currentProduct.imagem_principal);

      if (previousPath) {
        await supabaseAdmin.storage.from('produtos').remove([previousPath]);
      }
    }

    const product = await getProductWithStock(supabaseAdmin, productId);
    return NextResponse.json({ product: product ?? formatProduct(updatedProduct, []) });
  } catch (error) {
    if (uploadedPath) {
      await supabaseAdmin.storage.from('produtos').remove([uploadedPath]);
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao editar produto.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authorization = await requireActiveAdmin(request);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const { id } = await context.params;
    const productId = parseProductId(id);
    const { data: product, error } = await authorization.supabaseAdmin
      .from('produtos')
      .update({ ativo: false })
      .eq('id', productId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: `Erro ao desativar produto: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao desativar produto.' }, { status: 500 });
  }
}
