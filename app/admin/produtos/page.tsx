'use client';

import Image from 'next/image';
import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  normalizarEstoquePorCategoria,
  type CategoriaTipoGrade,
} from '@/config/grades-tamanho';
import { supabase } from '@/lib/supabase';
import { formatAdminCurrency, normalizeAdminCurrency, parseAdminCurrency } from '@/lib/admin-currency';
import { useProtectedRoute } from '@/lib/useAuth';
import AdminCurrencyInput from '../components/AdminCurrencyInput';
import AdminShell from '../components/AdminShell';

type Option = { id: number; nome: string; ativo: boolean; tipo_grade?: CategoriaTipoGrade };
type Stock = { id?: number; tamanho: string; quantidade: number };
type SavedImage = { id: number; url: string; principal: boolean; ordem: number };
type GalleryItem = { key: string; id?: number; file?: File; url: string };
type Product = {
  id: number; codigo_produto: string; nome: string; publico: string; categoria_id: number; marca_id: number | null;
  categoria: string; marca: string | null; preco: number; preco_promocional: number | null; em_promocao: boolean;
  ativo: boolean; descricao: string | null; imagem_principal: string | null; estoque: Stock[]; imagens: SavedImage[];
};
type ProductForm = {
  nome: string; publico: string; categoria_id: string; marca_id: string; preco: string;
  promocional: string; promocao: boolean; ativo: boolean; descricao: string;
};

const blankForm: ProductForm = {
  nome: '', publico: '', categoria_id: '', marca_id: '', preco: '',
  promocional: '', promocao: false, ativo: true, descricao: '',
};
const publicos = ['Masculino', 'Feminino', 'Infantil', 'Unissex'];

async function authToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sessão expirada.');
  return data.session.access_token;
}

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ProdutosPage() {
  useProtectedRoute();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [form, setForm] = useState<ProductForm>(blankForm);
  const [stock, setStock] = useState<Stock[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = categories.find((item) => String(item.id) === form.categoria_id);
  const undefinedBrand = brands.find((item) => item.nome.toLocaleLowerCase('pt-BR') === 'indefinida');

  const load = useCallback(async () => {
    try {
      const token = await authToken();
      const params = new URLSearchParams({ pageSize: '50' });
      if (search.trim()) params.set('search', search.trim());
      const [productsResponse, categoriesResponse, brandsResponse] = await Promise.all([
        fetch(`/api/admin/produtos?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/categorias?ativo=true', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/marcas?ativo=true', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [productsData, categoriesData, brandsData] = await Promise.all([
        productsResponse.json(), categoriesResponse.json(), brandsResponse.json(),
      ]);
      if (!productsResponse.ok || !categoriesResponse.ok || !brandsResponse.ok) {
        throw new Error(productsData.error || categoriesData.error || brandsData.error);
      }
      setProducts(productsData.products ?? []);
      setCategories(categoriesData.categorias ?? []);
      setBrands(brandsData.marcas ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar produtos.');
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const resetForCreate = useCallback(() => {
    setEditing(null);
    setForm({ ...blankForm, marca_id: undefinedBrand ? String(undefinedBrand.id) : '' });
    setStock([]);
    setGallery([]);
    setCreated(false);
    setMessage('');
  }, [undefinedBrand]);

  const openCreate = () => {
    resetForCreate();
    setModalOpen(true);
    window.setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const openEdit = (product: Product) => {
    const category = categories.find((item) => item.id === product.categoria_id);
    setEditing(product);
    setCreated(false);
    setForm({
      nome: product.nome,
      publico: product.publico,
      categoria_id: String(product.categoria_id),
      marca_id: product.marca_id ? String(product.marca_id) : undefinedBrand ? String(undefinedBrand.id) : '',
      preco: formatAdminCurrency(product.preco),
      promocional: formatAdminCurrency(product.preco_promocional),
      promocao: product.em_promocao,
      ativo: product.ativo,
      descricao: product.descricao ?? '',
    });
    setStock(category?.tipo_grade
      ? normalizarEstoquePorCategoria(product.estoque, category.tipo_grade)
      : product.estoque);
    setGallery((product.imagens?.length
      ? product.imagens
      : product.imagem_principal
        ? [{ id: -1, url: product.imagem_principal, principal: true, ordem: 0 }]
        : []
    ).map((image) => ({
      key: `saved-${image.id}`,
      id: image.id > 0 ? image.id : undefined,
      url: image.url,
    })));
    setMessage('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setCreated(false);
  };

  const updateForm = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectCategory = (categoryId: string) => {
    const category = categories.find((item) => String(item.id) === categoryId);
    setForm((current) => ({ ...current, categoria_id: categoryId }));
    setStock(category?.tipo_grade ? normalizarEstoquePorCategoria([], category.tipo_grade) : []);
  };

  const updateStock = (size: string, rawQuantity: string) => {
    const quantity = rawQuantity === '' ? 0 : Math.max(0, Number.parseInt(rawQuantity, 10) || 0);
    setStock((current) => current.map((item) => item.tamanho === size ? { ...item, quantidade: quantity } : item));
  };

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    if (gallery.length + incoming.length > 10) return setMessage('A galeria aceita até 10 fotos.');
    if (incoming.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      return setMessage('Use imagens JPG, PNG ou WebP de até 5 MB.');
    }
    setGallery((current) => [
      ...current,
      ...incoming.map((file) => ({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
    ]);
    setMessage('');
  };

  const removeImage = (item: GalleryItem) => {
    if (item.file) URL.revokeObjectURL(item.url);
    setGallery((current) => current.filter((candidate) => candidate !== item));
  };

  const dropFiles = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  };

  const moveImage = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    setGallery((current) => {
      const next = [...current];
      const [item] = next.splice(dragIndex, 1);
      next.splice(target, 0, item);
      return next;
    });
    setDragIndex(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.publico || !form.categoria_id || parseAdminCurrency(form.preco) === null) {
      return setMessage('Preencha todos os campos obrigatórios.');
    }
    if (!gallery.length) return setMessage('Adicione pelo menos uma foto.');
    if (!stock.length) return setMessage('Selecione uma categoria para carregar a grade de estoque.');

    setSaving(true);
    setMessage('');
    try {
      const data = new FormData();
      data.set('nome', form.nome.trim());
      data.set('publico', form.publico);
      data.set('categoria_id', form.categoria_id);
      data.set('marca_id', form.marca_id);
      data.set('preco', normalizeAdminCurrency(form.preco));
      data.set('em_promocao', String(form.promocao));
      data.set('preco_promocional', form.promocao ? normalizeAdminCurrency(form.promocional) : '');
      data.set('ativo', String(form.ativo));
      data.set('descricao', form.descricao);
      data.set('estoques', JSON.stringify(stock));
      const newFiles = gallery.filter((item) => item.file);
      newFiles.forEach((item) => data.append('imagens', item.file as File));
      if (editing) {
        data.set('gallery_order', JSON.stringify(gallery.map((item) =>
          item.id ? { id: item.id } : { newIndex: newFiles.indexOf(item) }
        )));
      }

      const response = await fetch(editing ? `/api/admin/produtos/${editing.id}` : '/api/admin/produtos', {
        method: editing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${await authToken()}` },
        body: data,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
      if (editing) {
        setModalOpen(false);
        setMessage('Produto atualizado com sucesso.');
      } else {
        setCreated(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  const createAnother = () => {
    gallery.forEach((item) => { if (item.file) URL.revokeObjectURL(item.url); });
    resetForCreate();
    window.setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  return (
    <AdminShell title="Produtos" subtitle="Catálogo, preços, estoque e galeria" active="produtos">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, categoria ou marca"
          className="flex-1 rounded-xl border border-[#D9CEC2] bg-white px-4 py-3 outline-none focus:border-[#C8722C]"
        />
        <button onClick={openCreate} className="rounded-xl bg-[#C8722C] px-6 py-3 font-bold text-white shadow-sm hover:bg-[#A9571E]">
          Novo produto
        </button>
      </div>

      {message && !modalOpen && <p className="mb-4 rounded-xl bg-[#F7F0E7] px-4 py-3 text-sm">{message}</p>}

      <div className="overflow-x-auto rounded-2xl border border-[#E7E0D8] bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F7F0E7]"><tr>
            {['Foto', 'Produto', 'Público', 'Categoria', 'Marca', 'Preço', 'Estoque', 'Status', ''].map((header) =>
              <th key={header} className="px-4 py-3">{header}</th>
            )}
          </tr></thead>
          <tbody className="divide-y divide-[#E7E0D8]">
            {products.map((product) => <tr key={product.id}>
              <td className="px-4 py-3"><div className="relative h-14 w-14 overflow-hidden rounded-lg bg-[#F7F0E7]">
                {product.imagem_principal && <Image src={product.imagem_principal} alt="" fill sizes="56px" className="object-cover" />}
              </div></td>
              <td className="px-4 py-3"><b>{product.nome}</b><small className="block text-[#6E625A]">{product.codigo_produto}</small></td>
              <td className="px-4 py-3">{product.publico}</td>
              <td className="px-4 py-3">{product.categoria}</td>
              <td className="px-4 py-3">{product.marca || 'Indefinida'}</td>
              <td className="px-4 py-3">{product.em_promocao && product.preco_promocional !== null
                ? <><s className="block text-xs">{money(product.preco)}</s><b>{money(product.preco_promocional)}</b></>
                : money(product.preco)}
              </td>
              <td className="px-4 py-3">{product.estoque.reduce((sum, item) => sum + item.quantidade, 0)}</td>
              <td className="px-4 py-3">{product.ativo ? 'Ativo' : 'Inativo'}</td>
              <td className="px-4 py-3"><button onClick={() => openEdit(product)} className="font-bold text-[#C8722C]">Editar</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>

      {modalOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#241C17]/60 p-2 backdrop-blur-[2px] sm:p-5">
        <form
          id="product-form"
          onSubmit={submit}
          className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#E7E0D8] bg-[#FFFEFC] shadow-2xl"
        >
          <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-[#E7E0D8] bg-[#FFFEFC]/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F0E7] text-[#8B451D]">
              <BoxIcon />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-black text-[#241C17]">{editing ? 'Editar produto' : 'Novo produto'}</h2>
              <p className="text-xs text-[#6E625A]">Campos com * são obrigatórios.</p>
            </div>
            <button type="button" onClick={closeModal} className="hidden rounded-lg border border-[#D9CEC2] px-4 py-2 text-sm font-bold text-[#4A2D1A] hover:bg-[#F7F0E7] sm:block">
              Cancelar
            </button>
            <button type="submit" disabled={saving || created} className="hidden rounded-lg bg-[#C05F16] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#A95012] disabled:opacity-60 sm:block">
              {saving ? 'Salvando...' : 'Salvar produto'}
            </button>
            <button type="button" onClick={closeModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F0E7] text-xl sm:hidden" aria-label="Fechar">×</button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {message && <div role="alert" className="mb-4 rounded-xl border border-[#E9C9AA] bg-[#FFF7EF] px-4 py-3 text-sm font-semibold text-[#8B451D]">{message}</div>}

            {created ? <SuccessPanel onAnother={createAnother} onClose={closeModal} /> : <div className="space-y-5">
              <Section number="1" title="Informações básicas">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Nome do produto *">
                    <input ref={nameInputRef} value={form.nome} onChange={(event) => updateForm('nome', event.target.value)} required className="input" placeholder="Ex.: Camisa Xadrez Country" />
                  </Field>
                  <Field label="Público *">
                    <select value={form.publico} onChange={(event) => updateForm('publico', event.target.value)} required className="input">
                      <option value="">Selecione</option>
                      {publicos.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field label="Categoria *">
                    <select value={form.categoria_id} onChange={(event) => selectCategory(event.target.value)} required className="input">
                      <option value="">Selecione</option>
                      {categories.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Marca">
                    <select value={form.marca_id} onChange={(event) => updateForm('marca_id', event.target.value)} className="input">
                      {brands.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.id === undefinedBrand?.id ? ' (padrão)' : ''}</option>)}
                    </select>
                  </Field>
                  <Field label="Preço *">
                    <AdminCurrencyInput value={form.preco} onValueChange={(value) => updateForm('preco', value)} required className="input" placeholder="R$ 0,00" />
                  </Field>
                  <Toggle label="Produto em promoção" checked={form.promocao} onChange={(value) => updateForm('promocao', value)} />
                  {form.promocao && <Field label="Preço promocional *">
                    <AdminCurrencyInput value={form.promocional} onValueChange={(value) => updateForm('promocional', value)} required className="input" placeholder="R$ 0,00" />
                  </Field>}
                  <Toggle label="Produto ativo" checked={form.ativo} onChange={(value) => updateForm('ativo', value)} />
                </div>
              </Section>

              <Section number="2" title="Tamanhos e estoque" subtitle="Os tamanhos são definidos automaticamente pela categoria.">
                {!selectedCategory?.tipo_grade ? <EmptyStock /> : <>
                  <div className="mb-3 rounded-lg border border-[#E9C9AA] bg-[#FFF8F1] px-3 py-2 text-sm font-semibold text-[#8B451D]">
                    Tamanhos definidos pela categoria: {selectedCategory.nome}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[#E7E0D8]">
                    <div className="grid grid-cols-2 bg-[#F9F6F1] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#6E625A]">
                      <span>Tamanho</span><span>Estoque</span>
                    </div>
                    <div className="grid grid-cols-1 divide-y divide-[#EFE8E0] sm:grid-cols-2 sm:divide-y-0">
                      {stock.map((item) => <label key={item.tamanho} className="grid grid-cols-2 items-center gap-3 border-b border-[#EFE8E0] px-4 py-2 sm:odd:border-r">
                        <span className="font-bold text-[#4A2D1A]">{item.tamanho}</span>
                        <input type="number" min="0" step="1" value={item.quantidade} onChange={(event) => updateStock(item.tamanho, event.target.value)} className="w-full rounded-lg border border-[#D9CEC2] px-3 py-2 text-center outline-none focus:border-[#C8722C]" aria-label={`Estoque tamanho ${item.tamanho}`} />
                      </label>)}
                    </div>
                  </div>
                </>}
              </Section>

              <Section number="3" title={`Fotos do produto (${gallery.length}/10)`} subtitle="A primeira foto é a capa do produto. Arraste as miniaturas para reordenar.">
                <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_1.2fr]">
                  <label onDragOver={(event) => event.preventDefault()} onDrop={dropFiles} className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CFB9A5] bg-[#FFFCF8] p-5 text-center transition hover:border-[#C8722C] hover:bg-[#FFF8F1]">
                    <UploadIcon />
                    <b className="mt-2 text-[#4A2D1A]">Arraste e solte as fotos aqui</b>
                    <span className="text-sm text-[#6E625A]">ou clique para selecionar</span>
                    <small className="mt-2 text-[#8B7768]">JPG, PNG ou WEBP · máximo 5 MB cada</small>
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && addFiles(event.target.files)} className="sr-only" />
                  </label>
                  {gallery.length === 0 ? <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-[#E7E0D8] bg-white p-5 text-center text-[#6E625A]">
                    <PhotoIcon /><b className="mt-2 text-[#4A2D1A]">Nenhuma foto adicionada</b><span className="text-sm">Adicione até 10 fotos do produto.</span>
                  </div> : <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {gallery.map((item, index) => <div
                      key={item.key}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveImage(index)}
                      className="group relative aspect-square cursor-grab overflow-hidden rounded-xl border-2 border-[#E7E0D8] bg-[#F7F0E7]"
                    >
                      <Image src={item.url} alt="" fill sizes="150px" className="object-cover" unoptimized={Boolean(item.file)} />
                      {index === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[#C05F16] px-2 py-1 text-[10px] font-black text-white">Principal</span>}
                      <button type="button" onClick={() => removeImage(item)} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 font-black text-red-700 shadow" aria-label="Excluir foto">×</button>
                      {index > 0 && <button type="button" onClick={() => setGallery((current) => [item, ...current.filter((candidate) => candidate !== item)])} className="absolute bottom-1.5 left-1.5 right-1.5 rounded-md bg-white/95 px-1 py-1 text-[10px] font-black text-[#8B451D] opacity-0 shadow transition group-hover:opacity-100 group-focus-within:opacity-100">Definir principal</button>}
                    </div>)}
                  </div>}
                </div>
              </Section>

              <Section number="4" title="Descrição do produto">
                <Field label="Descrição">
                  <textarea
                    rows={5}
                    value={form.descricao}
                    onChange={(event) => updateForm('descricao', event.target.value)}
                    className="input resize-y"
                    placeholder="Descreva características, material, medidas, uso e detalhes do produto..."
                  />
                  <span className="mt-1 block text-right text-xs text-[#8B7768]">{form.descricao.length} caracteres</span>
                </Field>
              </Section>
            </div>}
          </div>

          {!created && <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#E7E0D8] bg-[#FFFEFC] px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={closeModal} className="rounded-lg border border-[#D9CEC2] px-5 py-3 text-sm font-bold text-[#4A2D1A] hover:bg-[#F7F0E7]">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[#C05F16] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#A95012] disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar produto'}
            </button>
          </footer>}
        </form>
      </div>}
    </AdminShell>
  );
}

function Section({ number, title, subtitle, children }: { number: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="border-b border-[#E7E0D8] pb-5 last:border-0 last:pb-0">
    <div className="mb-3">
      <h3 className="flex items-center gap-2 text-base font-black text-[#241C17]">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F7F0E7] text-xs text-[#A9571E]">{number}</span>
        {title}
      </h3>
      {subtitle && <p className="ml-8 mt-0.5 text-xs text-[#6E625A]">{subtitle}</p>}
    </div>
    {children}
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#4A2D1A]">{label}</span>{children}</label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-[66px] items-end">
    <span className="block w-full">
      <span className="mb-1.5 block text-xs font-bold text-[#4A2D1A]">{label}</span>
      <span className="flex h-[42px] items-center gap-2 rounded-[0.65rem] border border-[#D9CEC2] bg-white px-3">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
        <span className="relative h-6 w-11 rounded-full bg-[#C8C5C2] transition peer-checked:bg-[#C05F16] after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        <span className="text-sm font-semibold">{checked ? 'Sim' : 'Não'}</span>
      </span>
    </span>
  </label>;
}

function EmptyStock() {
  return <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-[#E7E0D8] bg-white p-5 text-center">
    <BoxIcon /><b className="mt-2 text-[#4A2D1A]">Selecione uma categoria para carregar os tamanhos.</b>
    <span className="text-sm text-[#6E625A]">O estoque poderá ser informado para cada tamanho.</span>
  </div>;
}

function SuccessPanel({ onAnother, onClose }: { onAnother: () => void; onClose: () => void }) {
  return <div className="mx-auto flex min-h-[360px] max-w-xl flex-col items-center justify-center py-8 text-center">
    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">✓</span>
    <h3 className="mt-5 text-2xl font-black text-[#241C17]">Produto cadastrado com sucesso</h3>
    <p className="mt-2 text-[#6E625A]">Deseja cadastrar outro produto?</p>
    <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <button type="button" onClick={onClose} className="rounded-xl border border-[#D9CEC2] px-6 py-3 font-bold text-[#4A2D1A]">Fechar</button>
      <button type="button" onClick={onAnother} className="rounded-xl bg-[#C05F16] px-6 py-3 font-bold text-white">Cadastrar outro</button>
    </div>
  </div>;
}

function BoxIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6"><path d="m4.5 7 7.5-4 7.5 4-7.5 4-7.5-4Z"/><path d="M4.5 7v9l7.5 4 7.5-4V7M12 11v9"/></svg>;
}
function UploadIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-9 w-9 text-[#8B451D]"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 13.5a4 4 0 0 0 .5 8h13a3.5 3.5 0 0 0 .2-7A7 7 0 0 0 5 13.5Z"/></svg>;
}
function PhotoIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m5 17 5-5 3 3 2-2 4 4M8.5 9h.01"/></svg>;
}
