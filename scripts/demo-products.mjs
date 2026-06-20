import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const MODE = process.argv[2];
const VALID_MODES = new Set(['seed', 'verify', 'cleanup']);
const DEMO_PREFIX = 'DEMO-';
const DEMO_NAME_PREFIX = '[DEMO]';
const PRODUCTS_PER_CATEGORY = 3;
const PLACEHOLDER_IMAGE = '/brand/demo-product-placeholder.svg';
const UNIQUE_SIZE = 'Único';

if (!VALID_MODES.has(MODE)) {
  console.error('Uso: node scripts/demo-products.mjs <seed|verify|cleanup>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Configuração do Supabase ausente. Nenhuma chave foi exibida.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const numericSizeDepartments = new Set(['Calças', 'Bermudas', 'Shorts', 'Saias']);
const footwearDepartments = new Set(['Botas', 'Botinas', 'Tênis', 'Sandálias']);
const uniqueSizeDepartments = new Set(['Chapéus', 'Cintos', 'Bolsas', 'Carteiras', 'Fivelas', 'Lenços', 'Bijuterias', 'Bonés']);

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function assertQuery(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data ?? [];
}

function getAudience(department, category, position) {
  if (department === 'Blusas' || ['Saias', 'Vestidos', 'Bolsas', 'Bijuterias'].includes(department)) return 'Feminino';
  if (['Camisas', 'Bermudas', 'Botinas', 'Carteiras', 'Fivelas'].includes(department)) return 'Masculino';
  if (/body|cropped|salto|plataforma/i.test(category)) return 'Feminino';
  return ['Masculino', 'Feminino', 'Infantil'][position % 3];
}

function getSizes(department, audience) {
  if (uniqueSizeDepartments.has(department)) return [UNIQUE_SIZE];
  if (footwearDepartments.has(department)) return audience === 'Infantil' ? ['33', '35', '37'] : ['36', '39', '42'];
  if (audience === 'Infantil') return ['4', '8', '12'];
  if (numericSizeDepartments.has(department)) return ['36', '40', '44'];
  return ['P', 'M', 'G'];
}

function buildProducts(categories, departments, images) {
  const departmentById = new Map(departments.map((department) => [department.id, department]));

  return categories.flatMap((category, categoryIndex) => {
    const department = departmentById.get(category.departamento_id);
    if (!department) throw new Error(`Departamento ${category.departamento_id} não encontrado.`);

    return Array.from({ length: PRODUCTS_PER_CATEGORY }, (_, position) => {
      const sequence = position + 1;
      const audience = getAudience(department.nome, category.nome, position);
      const basePrice = 79.9 + department.id * 9 + categoryIndex % 7 * 13 + position * 24;
      const price = Number(basePrice.toFixed(2));
      const promotion = (categoryIndex + position) % 4 === 0;

      return {
        code: `${DEMO_PREFIX}${String(category.id).padStart(3, '0')}-${sequence}`,
        product: {
          codigo_produto: `${DEMO_PREFIX}${String(category.id).padStart(3, '0')}-${sequence}`,
          nome: `${DEMO_NAME_PREFIX} ${department.nome} ${category.nome} ${sequence}`,
          descricao: `Produto de demonstração para avaliar a vitrine de ${department.nome} / ${category.nome}.`,
          departamento_id: department.id,
          categoria_id: category.id,
          departamento: department.nome,
          categoria: category.nome,
          publico: audience,
          marca: 'Pastoril Demo',
          preco: price,
          preco_promocional: promotion ? Number((price * 0.85).toFixed(2)) : null,
          em_promocao: promotion,
          imagem_principal: images.length ? images[(categoryIndex + position) % images.length] : PLACEHOLDER_IMAGE,
          ativo: true,
          destaque: (categoryIndex + position) % 5 === 0,
        },
        stock: getSizes(department.nome, audience).map((size, sizeIndex) => ({
          tamanho: size,
          quantidade: 3 + ((categoryIndex + position + sizeIndex) % 8),
        })),
      };
    });
  });
}

async function loadCatalog() {
  const [departmentsResult, categoriesResult, productsResult] = await Promise.all([
    supabase.from('departamentos').select('id, nome, ativo, ordem').eq('ativo', true).order('ordem'),
    supabase.from('categorias').select('id, departamento_id, nome, ativo, ordem').eq('ativo', true).order('departamento_id').order('ordem'),
    supabase.from('produtos').select('id, codigo_produto, nome, imagem_principal, categoria_id, ativo'),
  ]);

  const departments = assertQuery(departmentsResult, 'Falha ao consultar departamentos');
  const categories = assertQuery(categoriesResult, 'Falha ao consultar categorias');
  const products = assertQuery(productsResult, 'Falha ao consultar produtos');
  const authorizedImages = [...new Set(products
    .filter((product) => !product.codigo_produto.startsWith(DEMO_PREFIX))
    .map((product) => product.imagem_principal)
    .filter((url) => typeof url === 'string' && url.includes('/storage/v1/object/public/produtos/')))];

  return { categories, departments, products, authorizedImages };
}

async function seed() {
  const catalog = await loadCatalog();
  const desired = buildProducts(catalog.categories, catalog.departments, catalog.authorizedImages);
  const existingByCode = new Map(catalog.products.map((product) => [product.codigo_produto, product]));
  const invalidCollisions = desired.filter(({ code }) => {
    const existing = existingByCode.get(code);
    return existing && !existing.nome.startsWith(DEMO_NAME_PREFIX);
  });

  if (invalidCollisions.length) throw new Error('Há colisão entre código DEMO e produto não identificado como demonstração. Operação cancelada.');

  const missing = desired.filter(({ code }) => !existingByCode.has(code));
  const insertedIds = [];

  try {
    for (const group of chunk(missing, 50)) {
      const inserted = assertQuery(
        await supabase.from('produtos').insert(group.map((item) => item.product)).select('id, codigo_produto'),
        'Falha ao inserir produtos DEMO',
      );
      insertedIds.push(...inserted.map((product) => product.id));
      inserted.forEach((product) => existingByCode.set(product.codigo_produto, product));
    }

    const demoIds = desired.map(({ code }) => existingByCode.get(code)?.id).filter(Boolean);
    const existingStock = demoIds.length
      ? assertQuery(await supabase.from('estoque_produtos').select('produto_id, tamanho').in('produto_id', demoIds), 'Falha ao consultar estoque DEMO')
      : [];
    const stockKeys = new Set(existingStock.map((item) => `${item.produto_id}:${item.tamanho}`));
    const stockToInsert = desired.flatMap(({ code, stock }) => {
      const productId = existingByCode.get(code)?.id;
      return stock
        .filter((item) => !stockKeys.has(`${productId}:${item.tamanho}`))
        .map((item) => ({ produto_id: productId, ...item }));
    });

    for (const group of chunk(stockToInsert, 500)) {
      assertQuery(await supabase.from('estoque_produtos').insert(group), 'Falha ao inserir estoque DEMO');
    }

    console.log(`Seed concluído: ${missing.length} produtos criados, ${desired.length - missing.length} já existentes, ${stockToInsert.length} linhas de estoque criadas.`);
  } catch (error) {
    if (insertedIds.length) {
      await supabase.from('estoque_produtos').delete().in('produto_id', insertedIds);
      await supabase.from('produtos').delete().in('id', insertedIds);
    }
    throw error;
  }
}

async function verify() {
  const catalog = await loadCatalog();
  const desired = buildProducts(catalog.categories, catalog.departments, catalog.authorizedImages);
  const desiredCodes = new Set(desired.map((item) => item.code));
  const demoProducts = catalog.products.filter((product) => desiredCodes.has(product.codigo_produto) && product.nome.startsWith(DEMO_NAME_PREFIX));
  const demoIds = demoProducts.map((product) => product.id);
  const stock = demoIds.length
    ? assertQuery(await supabase.from('estoque_produtos').select('produto_id, tamanho, quantidade').in('produto_id', demoIds), 'Falha ao verificar estoque')
    : [];
  const productByCode = new Map(demoProducts.map((product) => [product.codigo_produto, product]));
  const stockByProduct = new Map();
  stock.forEach((item) => stockByProduct.set(item.produto_id, [...(stockByProduct.get(item.produto_id) ?? []), item]));
  const coveredCategories = new Set(demoProducts.filter((product) => stock.some((item) => item.produto_id === product.id && item.quantidade > 0)).map((product) => product.categoria_id));
  const missingCategories = catalog.categories.filter((category) => !coveredCategories.has(category.id));
  const categoryCountsValid = catalog.categories.every(
    (category) => demoProducts.filter((product) => product.categoria_id === category.id).length === PRODUCTS_PER_CATEGORY,
  );
  const stockValid = desired.every(({ code, stock: expectedStock }) => {
    const product = productByCode.get(code);
    const actualStock = product ? stockByProduct.get(product.id) ?? [] : [];
    return expectedStock.length === actualStock.length && expectedStock.every((expected) =>
      actualStock.some((actual) => actual.tamanho === expected.tamanho && actual.quantidade === expected.quantidade),
    );
  });

  console.log(JSON.stringify({
    expectedProducts: desired.length,
    demoProducts: demoProducts.length,
    activeCategories: catalog.categories.length,
    coveredCategories: coveredCategories.size,
    missingCategories: missingCategories.map((category) => category.id),
    stockRows: stock.length,
    categoryCountsValid,
    stockValid,
    valid: demoProducts.length === desired.length && missingCategories.length === 0 && categoryCountsValid && stockValid,
  }, null, 2));
}

async function cleanup() {
  const products = assertQuery(
    await supabase.from('produtos').select('id, codigo_produto, nome').like('codigo_produto', `${DEMO_PREFIX}%`).like('nome', `${DEMO_NAME_PREFIX}%`),
    'Falha ao localizar produtos DEMO',
  );
  const ids = products.map((product) => product.id);
  if (!ids.length) {
    console.log('Nenhum produto DEMO encontrado.');
    return;
  }

  const referencedItems = assertQuery(await supabase.from('venda_itens').select('produto_id').in('produto_id', ids), 'Falha ao verificar referências de vendas');
  if (referencedItems.length) throw new Error('Há produtos DEMO referenciados por vendas. Limpeza cancelada para preservar o histórico.');

  assertQuery(await supabase.from('estoque_produtos').delete().in('produto_id', ids).select('id'), 'Falha ao remover estoque DEMO');
  const deleted = assertQuery(
    await supabase.from('produtos').delete().in('id', ids).like('codigo_produto', `${DEMO_PREFIX}%`).like('nome', `${DEMO_NAME_PREFIX}%`).select('id'),
    'Falha ao remover produtos DEMO',
  );
  console.log(`Limpeza concluída: ${deleted.length} produtos DEMO removidos.`);
}

try {
  if (MODE === 'seed') await seed();
  if (MODE === 'verify') await verify();
  if (MODE === 'cleanup') await cleanup();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Erro inesperado.');
  process.exit(1);
}
