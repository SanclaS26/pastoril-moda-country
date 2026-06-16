export const TAMANHO_UNICO = 'Único';

export type TipoGradeTamanho =
  | 'roupa_letras'
  | 'roupa_numeros'
  | 'calcado'
  | 'infantil'
  | 'tamanho_unico'
  | 'sem_tamanho';

export type EstoqueGradeInput = {
  id?: number;
  tamanho: string;
  quantidade: number;
};

export const gradesTamanho: Record<TipoGradeTamanho, string[]> = {
  roupa_letras: ['PP', 'P', 'M', 'G', 'GG', 'XG'],
  roupa_numeros: ['34', '36', '38', '40', '42', '44', '46', '48', '50'],
  calcado: ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  infantil: ['2', '4', '6', '8', '10', '12', '14', '16'],
  tamanho_unico: [TAMANHO_UNICO],
  sem_tamanho: [],
};

export const departamentosProduto = [
  'Camisas',
  'Blusas',
  'Calças',
  'Bermudas',
  'Shorts',
  'Saias',
  'Vestidos',
  'Conjuntos',
  'Macacões',
  'Jaquetas',
  'Coletes',
  'Botas',
  'Botinas',
  'Tênis',
  'Sandálias',
  'Chapéus',
  'Cintos',
  'Bolsas',
  'Carteiras',
  'Fivelas',
  'Lenços',
  'Bijuterias',
  'Bonés',
] as const;

const gradePorDepartamento: Record<string, TipoGradeTamanho> = {
  Camisas: 'roupa_letras',
  Blusas: 'roupa_letras',
  Vestidos: 'roupa_letras',
  Conjuntos: 'roupa_letras',
  Macacões: 'roupa_letras',
  Jaquetas: 'roupa_letras',
  Coletes: 'roupa_letras',
  Calças: 'roupa_numeros',
  Bermudas: 'roupa_numeros',
  Shorts: 'roupa_numeros',
  Saias: 'roupa_numeros',
  Botas: 'calcado',
  Botinas: 'calcado',
  Tênis: 'calcado',
  Sandálias: 'calcado',
  Chapéus: 'tamanho_unico',
  Cintos: 'tamanho_unico',
  Lenços: 'tamanho_unico',
  Bonés: 'tamanho_unico',
  Bolsas: 'sem_tamanho',
  Carteiras: 'sem_tamanho',
  Fivelas: 'sem_tamanho',
  Bijuterias: 'sem_tamanho',
};

export function getTipoGradeTamanho(departamento: string, publico?: string | null): TipoGradeTamanho {
  const grade = gradePorDepartamento[departamento] ?? 'roupa_letras';

  if (publico === 'Infantil' && grade !== 'calcado' && grade !== 'tamanho_unico' && grade !== 'sem_tamanho') {
    return 'infantil';
  }

  return grade;
}

export function getOpcoesTamanho(departamento: string, publico?: string | null) {
  return gradesTamanho[getTipoGradeTamanho(departamento, publico)];
}

export function isGradeSemTamanho(tipoGrade: TipoGradeTamanho) {
  return tipoGrade === 'sem_tamanho';
}

export function isGradeTamanhoUnico(tipoGrade: TipoGradeTamanho) {
  return tipoGrade === 'tamanho_unico';
}

export function isGradeSemSeletor(tipoGrade: TipoGradeTamanho) {
  return tipoGrade === 'sem_tamanho' || tipoGrade === 'tamanho_unico';
}

export function normalizeEstoqueParaGrade<T extends EstoqueGradeInput>(
  estoque: T[],
  departamento: string,
  publico?: string | null,
) {
  const tipoGrade = getTipoGradeTamanho(departamento, publico);
  const opcoes = gradesTamanho[tipoGrade];

  if (isGradeSemSeletor(tipoGrade)) {
    if (!estoque.length) return [];

    const quantidade = estoque.reduce((total, item) => total + item.quantidade, 0);
    return [{ ...estoque[0], tamanho: TAMANHO_UNICO, quantidade }];
  }

  const tamanhosPermitidos = new Set(opcoes.map((opcao) => opcao.toLowerCase()));
  const vistos = new Set<string>();
  const normalizado: T[] = [];

  for (const item of estoque) {
    const tamanho = item.tamanho.trim();
    const chave = tamanho.toLowerCase();

    if (!tamanhosPermitidos.has(chave) || vistos.has(chave)) {
      continue;
    }

    vistos.add(chave);
    normalizado.push({ ...item, tamanho });
  }

  return normalizado;
}

export function validarEstoqueParaGrade(
  estoque: EstoqueGradeInput[],
  departamento: string,
  publico?: string | null,
) {
  const tipoGrade = getTipoGradeTamanho(departamento, publico);
  const estoqueNormalizado = normalizeEstoqueParaGrade(estoque, departamento, publico);

  if (!estoqueNormalizado.length) {
    throw new Error(isGradeSemTamanho(tipoGrade) ? 'Informe a quantidade em estoque.' : 'Adicione pelo menos um tamanho ao produto.');
  }

  if (isGradeSemSeletor(tipoGrade)) {
    if (estoqueNormalizado.length !== 1 || estoqueNormalizado[0].tamanho !== TAMANHO_UNICO) {
      throw new Error('Produtos sem grade devem ter apenas uma quantidade em estoque.');
    }

    return estoqueNormalizado;
  }

  if (estoqueNormalizado.length !== estoque.length) {
    throw new Error('O tamanho informado não pertence à grade da categoria selecionada.');
  }

  const opcoes = new Set(gradesTamanho[tipoGrade].map((opcao) => opcao.toLowerCase()));
  const vistos = new Set<string>();

  for (const item of estoqueNormalizado) {
    const chave = item.tamanho.toLowerCase();

    if (!opcoes.has(chave)) {
      throw new Error('O tamanho informado não pertence à grade da categoria selecionada.');
    }

    if (vistos.has(chave)) {
      throw new Error('Não repita o mesmo tamanho no estoque do produto.');
    }

    vistos.add(chave);
  }

  return estoqueNormalizado;
}
