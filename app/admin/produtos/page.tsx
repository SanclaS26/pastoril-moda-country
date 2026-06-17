'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  TAMANHO_UNICO,
  getOpcoesTamanho,
  getTipoGradeTamanho,
  isGradeSemSeletor,
  isGradeSemTamanho,
  isGradeTamanhoUnico,
  normalizeEstoqueParaGrade,
} from '@/config/grades-tamanho';
import { useProtectedRoute } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import AdminShell from '../components/AdminShell';

type StockItem = { id?: number; tamanho: string; quantidade: number };

type Departamento = { id: number; nome: string; ativo: boolean; ordem: number | null };
type Categoria = { id: number; departamento_id: number; nome: string; ativo: boolean; ordem: number | null };

type Product = {
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
  estoque: StockItem[];
};

type ProductFormState = {
  codigo_produto: string;
  nome: string;
  departamento_id: string;
  categoria_id: string;
  departamento: string;
  categoria: string;
  publico: string;
  marca: string;
  preco: string;
  preco_promocional: string;
  em_promocao: boolean;
  descricao: string;
  ativo: boolean;
  destaque: boolean;
};

const emptyForm: ProductFormState = {
  codigo_produto: '',
  nome: '',
  departamento_id: '',
  categoria_id: '',
  departamento: '',
  categoria: '',
  publico: '',
  marca: '',
  preco: '',
  preco_promocional: '',
  em_promocao: false,
  descricao: '',
  ativo: true,
  destaque: false,
};

const publicos = ['Feminino', 'Masculino', 'Infantil', 'Unissex'];

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Sessão administrativa inválida ou expirada. Faça login novamente.');
  }
  return data.session.access_token;
}

function formatCurrency(value: number | null) {
  if (value === null) return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getTotalStock(product: Product) {
  return product.estoque.reduce((total, item) => total + item.quantidade, 0);
}

function getStockSummary(product: Product) {
  if (!product.estoque.length) return '-';
  const tipoGrade = getTipoGradeTamanho(product.departamento, product.publico);

  if (isGradeSemTamanho(tipoGrade)) {
    return `${getTotalStock(product)} unidades`;
  }

  if (isGradeTamanhoUnico(tipoGrade)) {
    return `Tamanho único: ${getTotalStock(product)}`;
  }

  return product.estoque.map((item) => `${item.tamanho}: ${item.quantidade}`).join(' | ');
}

function productToForm(product: Product): ProductFormState {
  return {
    codigo_produto: product.codigo_produto,
    nome: product.nome,
    departamento_id: product.departamento_id ? String(product.departamento_id) : '',
    categoria_id: product.categoria_id ? String(product.categoria_id) : '',
    departamento: product.departamento,
    categoria: product.categoria,
    publico: product.publico ?? '',
    marca: product.marca ?? '',
    preco: String(product.preco),
    preco_promocional: product.preco_promocional === null ? '' : String(product.preco_promocional),
    em_promocao: product.em_promocao,
    descricao: product.descricao ?? '',
    ativo: product.ativo,
    destaque: product.destaque,
  };
}

export default function AdminProdutosPage() {
  const router = useRouter();
  useProtectedRoute();

  const [products, setProducts] = useState<Product[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(true);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [promotionFilter, setPromotionFilter] = useState<'todos' | 'promocao'>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockSize, setStockSize] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [editingStockIndex, setEditingStockIndex] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  const filteredProducts = useMemo(
    () => products.filter((product) => promotionFilter === 'todos' || product.em_promocao),
    [products, promotionFilter],
  );
  const tipoGradeAtual = useMemo(
    () => getTipoGradeTamanho(form.departamento, form.publico || null),
    [form.departamento, form.publico],
  );
  const opcoesTamanhoAtuais = useMemo(
    () => getOpcoesTamanho(form.departamento, form.publico || null),
    [form.departamento, form.publico],
  );
  const produtoSemSeletor = isGradeSemSeletor(tipoGradeAtual);
  const produtoSemTamanho = isGradeSemTamanho(tipoGradeAtual);
  const produtoTamanhoUnico = isGradeTamanhoUnico(tipoGradeAtual);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const response = await fetch('/api/admin/produtos', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar produtos.');
      setProducts(Array.isArray(data.products) ? data.products : []);
      setError('');
    } catch (fetchError) {
      setProducts([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar produtos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartamentos = async () => {
    try {
      setLoadingDepartamentos(true);
      const token = await getSessionToken();
      const response = await fetch('/api/admin/departamentos', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar departamentos.');
      setDepartamentos(Array.isArray(data.departamentos) ? data.departamentos : []);
    } catch (fetchError) {
      setDepartamentos([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar departamentos.');
    } finally {
      setLoadingDepartamentos(false);
    }
  };

  const fetchCategorias = async (departamentoId: string) => {
    if (!departamentoId) {
      setCategorias([]);
      return [];
    }

    try {
      setLoadingCategorias(true);
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/categorias?departamento_id=${departamentoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao carregar categorias.');
      const nextCategorias = Array.isArray(data.categorias) ? data.categorias : [];
      setCategorias(nextCategorias);
      return nextCategorias as Categoria[];
    } catch (fetchError) {
      setCategorias([]);
      setFormError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar categorias.');
      return [];
    } finally {
      setLoadingCategorias(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchProducts(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchDepartamentos(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setCategorias([]);
    setStock([]);
    setStockSize('');
    setStockQuantity('');
    setEditingStockIndex(null);
    setImageFile(null);
    setImagePreview('');
    setFormError('');
    setSuccessMessage('');
    setFormOpen(true);
  };

  const openEditForm = async (product: Product) => {
    setEditingProduct(product);
    const foundDepartamento = product.departamento_id
      ? departamentos.find((departamento) => departamento.id === product.departamento_id)
      : departamentos.find((departamento) => departamento.nome.toLowerCase() === product.departamento.toLowerCase());
    const departamentoId = foundDepartamento?.id ?? product.departamento_id;
    const nextCategorias = departamentoId ? await fetchCategorias(String(departamentoId)) : [];
    const foundCategoria = product.categoria_id
      ? nextCategorias.find((categoria) => categoria.id === product.categoria_id)
      : nextCategorias.find((categoria) => categoria.nome.toLowerCase() === product.categoria.toLowerCase());

    setForm({
      ...productToForm(product),
      departamento_id: departamentoId ? String(departamentoId) : '',
      categoria_id: foundCategoria?.id ? String(foundCategoria.id) : product.categoria_id ? String(product.categoria_id) : '',
      departamento: foundDepartamento?.nome ?? product.departamento,
      categoria: foundCategoria?.nome ?? product.categoria,
    });
    setStock(product.estoque);
    setStockSize('');
    setStockQuantity('');
    setEditingStockIndex(null);
    setImageFile(null);
    setImagePreview(product.imagem_principal ?? '');
    setFormError('');
    setSuccessMessage('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (!saving) setFormOpen(false);
  };

  const applyGradeChange = (nextForm: ProductFormState) => {
    setStock((current) => normalizeEstoqueParaGrade(current, nextForm.departamento, nextForm.publico || null));
    setStockSize('');
    setStockQuantity('');
    setEditingStockIndex(null);
  };

  const updateForm = (field: keyof ProductFormState, value: string | boolean) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'em_promocao' && value === false) next.preco_promocional = '';
      return next;
    });
  };

  const updateFormAndGrade = (field: 'publico', value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      applyGradeChange(next);
      return next;
    });
  };

  const handleDepartamentoChange = async (departamentoId: string) => {
    const selectedDepartamento = departamentos.find((departamento) => String(departamento.id) === departamentoId);
    const nextForm = {
      ...form,
      departamento_id: departamentoId,
      departamento: selectedDepartamento?.nome ?? '',
      categoria_id: '',
      categoria: '',
    };

    setForm(nextForm);
    applyGradeChange(nextForm);
    setCategorias([]);
    setFormError('');
    await fetchCategorias(departamentoId);
  };

  const handleCategoriaChange = (categoriaId: string) => {
    const selectedCategoria = categorias.find((categoria) => String(categoria.id) === categoriaId);
    setForm((current) => ({
      ...current,
      categoria_id: categoriaId,
      categoria: selectedCategoria?.nome ?? '',
    }));
  };

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : editingProduct?.imagem_principal ?? '');
  };

  const clearStockEntry = () => {
    setStockSize('');
    setStockQuantity('');
    setEditingStockIndex(null);
  };

  const getCurrentStockSize = () => (produtoSemSeletor ? TAMANHO_UNICO : stockSize.trim());

  const addOrUpdateStockItem = () => {
    const tamanho = getCurrentStockSize();
    const quantidade = Number(stockQuantity);
    if (!produtoSemSeletor && !tamanho) return setFormError('Selecione um tamanho.');
    if (!Number.isInteger(quantidade) || quantidade <= 0) return setFormError('Informe uma quantidade maior que zero.');

    if (!produtoSemSeletor && !opcoesTamanhoAtuais.includes(tamanho)) {
      return setFormError('O tamanho selecionado não pertence à grade da categoria.');
    }

    if (stock.some((item, index) => item.tamanho.toLowerCase() === tamanho.toLowerCase() && index !== editingStockIndex)) {
      return setFormError('Este tamanho já foi adicionado.');
    }

    setStock((current) => {
      const nextItem = { ...(editingStockIndex !== null ? current[editingStockIndex] : {}), tamanho, quantidade };
      if (produtoSemSeletor) {
        const existingId = current[0]?.id;
        return [{ ...(existingId ? { id: existingId } : {}), tamanho: TAMANHO_UNICO, quantidade }];
      }
      return editingStockIndex === null
        ? [...current, nextItem]
        : current.map((item, index) => (index === editingStockIndex ? nextItem : item));
    });
    setFormError('');
    clearStockEntry();
  };

  const editStockItem = (index: number) => {
    const item = stock[index];
    setStockSize(produtoSemSeletor ? '' : item.tamanho);
    setStockQuantity(String(item.quantidade));
    setEditingStockIndex(index);
  };

  const removeStockItem = (index: number) => {
    setStock((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (editingStockIndex === index) clearStockEntry();
  };

  const validateClientForm = () => {
    if (!form.codigo_produto.trim()) return 'Código da peça é obrigatório.';
    if (!form.nome.trim()) return 'Nome é obrigatório.';
    if (!form.departamento_id || !form.departamento) return 'Departamento é obrigatório.';
    if (!form.categoria_id || !form.categoria.trim()) return 'Categoria é obrigatória.';

    const price = Number(form.preco.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) return 'Preço deve ser maior ou igual a zero.';

    if (form.em_promocao) {
      const promotionalPrice = Number(form.preco_promocional.replace(',', '.'));
      if (!form.preco_promocional.trim()) return 'Preço promocional é obrigatório para produto em promoção.';
      if (!Number.isFinite(promotionalPrice) || promotionalPrice < 0) return 'Preço promocional deve ser maior ou igual a zero.';
      if (promotionalPrice >= price) return 'Preço promocional deve ser menor que o preço normal.';
    }

    if (!editingProduct && !imageFile) return 'A foto do produto é obrigatória.';
    if (imageFile) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) return 'A imagem deve ser JPG, PNG ou WebP.';
      if (imageFile.size > 5 * 1024 * 1024) return 'A imagem deve ter no máximo 5 MB.';
    }
    const normalizedStock = normalizeEstoqueParaGrade(stock, form.departamento, form.publico || null);
    if (!normalizedStock.length) return produtoSemTamanho ? 'Informe a quantidade em estoque.' : 'Adicione pelo menos um tamanho ao produto.';

    if (produtoSemSeletor) {
      if (normalizedStock.length !== 1 || normalizedStock[0].tamanho !== TAMANHO_UNICO) return 'Produtos sem grade devem ter apenas uma quantidade em estoque.';
    } else if (normalizedStock.length !== stock.length) {
      return 'Remova tamanhos que não pertencem à grade da categoria selecionada.';
    }

    return '';
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('codigo_produto', form.codigo_produto.trim());
    formData.append('nome', form.nome.trim());
    formData.append('departamento_id', form.departamento_id);
    formData.append('categoria_id', form.categoria_id);
    formData.append('departamento', form.departamento);
    formData.append('categoria', form.categoria.trim());
    formData.append('publico', form.publico);
    formData.append('marca', form.marca.trim());
    formData.append('preco', form.preco);
    formData.append('em_promocao', String(form.em_promocao));
    formData.append('preco_promocional', form.em_promocao ? form.preco_promocional : '');
    formData.append('descricao', form.descricao.trim());
    formData.append('ativo', String(form.ativo));
    formData.append('destaque', String(form.destaque));
    const normalizedStock = normalizeEstoqueParaGrade(stock, form.departamento, form.publico || null);
    formData.append('estoques', JSON.stringify(normalizedStock.map((item) => ({
      id: item.id,
      tamanho: item.tamanho.trim(),
      quantidade: item.quantidade,
    }))));
    if (imageFile) formData.append('imagem', imageFile);
    return formData;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const validationMessage = validateClientForm();
    if (validationMessage) return setFormError(validationMessage);

    setSaving(true);
    setFormError('');
    setSuccessMessage('');
    try {
      const token = await getSessionToken();
      const response = await fetch(editingProduct ? `/api/admin/produtos/${editingProduct.id}` : '/api/admin/produtos', {
        method: editingProduct ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: buildFormData(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao salvar produto.');
      await fetchProducts();
      setSuccessMessage(editingProduct ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
      setFormOpen(false);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (product: Product) => {
    if (deactivatingId) return;
    setDeactivatingId(product.id);
    setError('');
    setSuccessMessage('');
    try {
      const token = await getSessionToken();
      const response = await fetch(`/api/admin/produtos/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao desativar produto.');
      setProducts((current) => current.map((item) => (item.id === product.id ? { ...item, ativo: false } : item)));
      setSuccessMessage('Produto desativado com sucesso.');
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'Erro ao desativar produto.');
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <AdminShell title="Produtos" subtitle="Cadastro real de produtos e estoque por tamanho." active="produtos">
      <div>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Produtos</h1>
            <p className="mt-1 text-sm text-slate-600">Cadastro real de produtos e estoque por tamanho.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={promotionFilter}
              onChange={(event) => setPromotionFilter(event.target.value as 'todos' | 'promocao')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              <option value="todos">Todos</option>
              <option value="promocao">Em promoção</option>
            </select>
            <button onClick={() => router.push('/admin')} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Voltar ao painel
            </button>
            <button onClick={openCreateForm} className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">
              Novo Produto
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {successMessage && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Foto', 'Código', 'Nome', 'Departamento', 'Categoria', 'Marca', 'Preço', 'Promoção', 'Estoque total', 'Tamanhos', 'Status', 'Ações'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-6 py-10 text-center text-sm text-slate-600">Carregando produtos...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={12} className="px-6 py-10 text-center text-sm text-slate-600">Nenhum produto encontrado.</td></tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        {product.imagem_principal ? (
                          <div className="relative h-14 w-14 overflow-hidden rounded-md">
                            <Image src={product.imagem_principal} alt={product.nome} fill sizes="56px" className="object-cover" />
                          </div>
                        ) : <div className="h-14 w-14 rounded-md bg-slate-100" />}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{product.codigo_produto}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">{product.nome}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{product.departamento}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{product.categoria}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{product.marca || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <div className="font-semibold">{formatCurrency(product.preco)}</div>
                        {product.em_promocao && <div className="text-amber-700">{formatCurrency(product.preco_promocional)}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {product.em_promocao ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Promoção</span> : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{getTotalStock(product)}</td>
                      <td className="max-w-[240px] px-4 py-3 text-sm text-slate-700">{getStockSummary(product)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${product.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                          {product.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => void openEditForm(product)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">Editar</button>
                          <button onClick={() => handleDeactivate(product)} disabled={!product.ativo || deactivatingId === product.id} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">
                            {deactivatingId === product.id ? 'Desativando...' : 'Desativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 px-4 py-6">
          <div className="mx-auto w-full max-w-5xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{editingProduct ? 'Editar produto' : 'Novo produto'}</h2>
                <p className="text-sm text-slate-600">Preencha os dados da peça e do estoque.</p>
              </div>
              <button type="button" onClick={closeForm} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Fechar</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              {formError && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Código da peça no sistema local</span>
                  <input value={form.codigo_produto} onChange={(event) => updateForm('codigo_produto', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Nome</span>
                  <input value={form.nome} onChange={(event) => updateForm('nome', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Departamento</span>
                  <select value={form.departamento_id} onChange={(event) => void handleDepartamentoChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    <option value="">{loadingDepartamentos ? 'Carregando departamentos...' : 'Selecione'}</option>
                    {departamentos.map((departamento) => <option key={departamento.id} value={departamento.id}>{departamento.nome}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Categoria</span>
                  <select
                    value={form.categoria_id}
                    onChange={(event) => handleCategoriaChange(event.target.value)}
                    disabled={!form.departamento_id || loadingCategorias}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {!form.departamento_id ? (
                      <option value="">Selecione primeiro um departamento</option>
                    ) : (
                      <option value="">{loadingCategorias ? 'Carregando categorias...' : 'Selecione'}</option>
                    )}
                    {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Público</span>
                  <select value={form.publico} onChange={(event) => updateFormAndGrade('publico', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200">
                    <option value="">Selecione</option>
                    {publicos.map((publico) => <option key={publico} value={publico}>{publico}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Marca</span>
                  <input value={form.marca} onChange={(event) => updateForm('marca', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Preço</span>
                  <input value={form.preco} onChange={(event) => updateForm('preco', event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.em_promocao} onChange={(event) => updateForm('em_promocao', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-600" />
                  Produto em promoção
                </label>
                {form.em_promocao && (
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Preço promocional</span>
                    <input value={form.preco_promocional} onChange={(event) => updateForm('preco_promocional', event.target.value)} inputMode="decimal" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  </label>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Descrição</span>
                <textarea value={form.descricao} onChange={(event) => updateForm('descricao', event.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              </label>

              <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Foto</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900" />
                </label>
                <div className="relative h-40 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Pré-visualização"
                      fill
                      sizes="220px"
                      unoptimized={imagePreview.startsWith('blob:')}
                      className="object-cover"
                    />
                  ) : <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem foto</div>}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-base font-bold text-slate-900">Tamanhos e quantidades</h3>
                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_160px_auto]">
                  <div className="space-y-3">
                    {produtoSemTamanho ? (
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        Produto sem variação de tamanho
                      </div>
                    ) : produtoTamanhoUnico ? (
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        Tamanho único
                      </div>
                    ) : (
                      <label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-700">Tamanho</span>
                        <select value={stockSize} onChange={(event) => setStockSize(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200">
                          <option value="">Selecione</option>
                          {opcoesTamanhoAtuais.map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">{produtoSemSeletor ? 'Quantidade em estoque' : 'Quantidade'}</span>
                    <input value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} type="number" min={1} className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200" />
                  </label>
                  <div className="flex items-end">
                    <button type="button" onClick={addOrUpdateStockItem} className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700">
                      {produtoSemSeletor
                        ? (stock.length ? 'Atualizar estoque' : 'Adicionar estoque')
                        : (editingStockIndex === null ? 'Adicionar tamanho' : 'Atualizar tamanho')}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {stock.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600">
                      {produtoSemSeletor ? 'Nenhuma quantidade informada.' : 'Nenhum tamanho adicionado.'}
                    </div>
                  ) : (
                    stock.map((item, index) => (
                      <div key={`${item.id ?? 'new'}-${item.tamanho}`} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {produtoSemTamanho ? 'Quantidade em estoque' : produtoTamanhoUnico ? 'Tamanho único' : item.tamanho} - {item.quantidade} unidades
                        </p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => editStockItem(index)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">Editar</button>
                          <button type="button" onClick={() => removeStockItem(index)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100">Remover</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={form.ativo} onChange={(event) => updateForm('ativo', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-600" />
                    Ativo
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={form.destaque} onChange={(event) => updateForm('destaque', event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-amber-600" />
                    Destaque
                  </label>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                  <button type="submit" disabled={saving} className="rounded-lg bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {saving ? 'Salvando produto...' : 'Salvar produto'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </AdminShell>
  );
}
