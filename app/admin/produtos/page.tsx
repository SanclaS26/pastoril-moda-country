'use client';

import Image from 'next/image';
import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { TAMANHO_UNICO, getOpcoesTamanho, getTipoGradeTamanho, isGradeSemSeletor, normalizeEstoqueParaGrade } from '@/config/grades-tamanho';
import { supabase } from '@/lib/supabase';
import { useProtectedRoute } from '@/lib/useAuth';
import AdminShell from '../components/AdminShell';

type Option = { id: number; nome: string; ativo: boolean };
type Stock = { id?: number; tamanho: string; quantidade: number };
type SavedImage = { id: number; url: string; principal: boolean; ordem: number };
type GalleryItem = { key: string; id?: number; file?: File; url: string };
type Product = {
  id: number; codigo_produto: string; nome: string; publico: string; categoria_id: number; marca_id: number | null;
  categoria: string; marca: string | null; preco: number; preco_promocional: number | null; em_promocao: boolean;
  ativo: boolean; descricao: string | null; imagem_principal: string | null; estoque: Stock[]; imagens: SavedImage[];
};
type Form = { nome: string; publico: string; categoria_id: string; marca_id: string; preco: string; promocional: string; promocao: boolean; ativo: boolean; descricao: string };

const blank: Form = { nome: '', publico: '', categoria_id: '', marca_id: '', preco: '', promocional: '', promocao: false, ativo: true, descricao: '' };
const publics = ['Masculino', 'Feminino', 'Infantil', 'Unissex'];

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
  const [form, setForm] = useState<Form>(blank);
  const [stock, setStock] = useState<Stock[]>([]);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState('');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const selectedCategory = categories.find((item) => String(item.id) === form.categoria_id);
  const grade = useMemo(() => getTipoGradeTamanho(selectedCategory?.nome ?? '', form.publico || null), [selectedCategory, form.publico]);
  const sizes = useMemo(() => getOpcoesTamanho(selectedCategory?.nome ?? '', form.publico || null), [selectedCategory, form.publico]);
  const noSelector = isGradeSemSeletor(grade);

  const load = useCallback(async () => {
    try {
      const token = await authToken();
      const params = new URLSearchParams({ pageSize: '50' });
      if (search.trim()) params.set('search', search.trim());
      const [p, c, b] = await Promise.all([
        fetch(`/api/admin/produtos?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/categorias?ativo=true', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/marcas?ativo=true', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [pd, cd, bd] = await Promise.all([p.json(), c.json(), b.json()]);
      if (!p.ok || !c.ok || !b.ok) throw new Error(pd.error || cd.error || bd.error);
      setProducts(pd.products ?? []); setCategories(cd.categorias ?? []); setBrands(bd.marcas ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao carregar produtos.'); }
  }, [search]);

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => () => gallery.forEach((item) => { if (item.file) URL.revokeObjectURL(item.url); }), [gallery]);

  const create = () => {
    setEditing(null); setForm(blank); setStock([]); setGallery([]); setMessage(''); setOpen(true);
  };
  const edit = (product: Product) => {
    setEditing(product);
    setForm({
      nome: product.nome, publico: product.publico, categoria_id: String(product.categoria_id),
      marca_id: product.marca_id ? String(product.marca_id) : '', preco: String(product.preco),
      promocional: product.preco_promocional === null ? '' : String(product.preco_promocional),
      promocao: product.em_promocao, ativo: product.ativo, descricao: product.descricao ?? '',
    });
    setStock(product.estoque);
    setGallery((product.imagens?.length ? product.imagens : product.imagem_principal ? [{ id: -1, url: product.imagem_principal, principal: true, ordem: 0 }] : [])
      .map((image) => ({ key: `saved-${image.id}`, id: image.id > 0 ? image.id : undefined, url: image.url })));
    setOpen(true); setMessage('');
  };
  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'publico' || key === 'categoria_id') {
      const next = { ...form, [key]: value };
      const category = categories.find((item) => String(item.id) === next.categoria_id);
      setStock((current) => normalizeEstoqueParaGrade(current, category?.nome ?? '', next.publico || null));
    }
  };
  const addStock = () => {
    const tamanho = noSelector ? TAMANHO_UNICO : size;
    const quantidade = Number(quantity);
    if (!tamanho || !Number.isInteger(quantidade) || quantidade <= 0) return setMessage('Selecione o tamanho e informe uma quantidade válida.');
    setStock((current) => [...current.filter((item) => item.tamanho !== tamanho), { tamanho, quantidade }]);
    setSize(''); setQuantity(''); setMessage('');
  };
  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    if (gallery.length + incoming.length > 10) return setMessage('A galeria aceita até 10 fotos.');
    if (incoming.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) return setMessage('Use imagens JPG, PNG ou WebP de até 5 MB.');
    setGallery((current) => [...current, ...incoming.map((file) => ({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
  };
  const dropFiles = (event: DragEvent) => { event.preventDefault(); if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files); };
  const move = (target: number) => {
    if (dragIndex === null || dragIndex === target) return;
    setGallery((current) => { const next = [...current]; const [item] = next.splice(dragIndex, 1); next.splice(target, 0, item); return next; });
    setDragIndex(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.nome || !form.publico || !form.categoria_id || !form.preco) return setMessage('Preencha todos os campos obrigatórios.');
    if (!gallery.length) return setMessage('Adicione pelo menos uma foto.');
    if (!stock.length) return setMessage('Adicione estoque ao produto.');
    setSaving(true); setMessage('');
    try {
      const data = new FormData();
      data.set('nome', form.nome); data.set('publico', form.publico); data.set('categoria_id', form.categoria_id);
      data.set('marca_id', form.marca_id); data.set('preco', form.preco); data.set('em_promocao', String(form.promocao));
      data.set('preco_promocional', form.promocao ? form.promocional : ''); data.set('ativo', String(form.ativo));
      data.set('descricao', form.descricao); data.set('estoques', JSON.stringify(stock));
      const newFiles = gallery.filter((item) => item.file);
      newFiles.forEach((item) => data.append('imagens', item.file as File));
      if (editing) {
        data.set('gallery_order', JSON.stringify(gallery.map((item) => item.id ? { id: item.id } : { newIndex: newFiles.indexOf(item) })));
      }
      const response = await fetch(editing ? `/api/admin/produtos/${editing.id}` : '/api/admin/produtos', {
        method: editing ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${await authToken()}` }, body: data,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setOpen(false); setMessage('Produto salvo com sucesso.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erro ao salvar produto.'); }
    finally { setSaving(false); }
  };

  return <AdminShell title="Produtos" subtitle="Catálogo, preços, estoque e galeria" active="produtos">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, categoria ou marca" className="flex-1 rounded-xl border border-[#D9CEC2] bg-white px-4 py-3" />
      <button onClick={create} className="rounded-xl bg-[#C8722C] px-6 py-3 font-bold text-white">Novo produto</button>
    </div>
    {message && <p className="mb-4 rounded-xl bg-[#F7F0E7] px-4 py-3 text-sm">{message}</p>}
    <div className="overflow-x-auto rounded-2xl border border-[#E7E0D8] bg-white">
      <table className="min-w-full text-left text-sm"><thead className="bg-[#F7F0E7]"><tr>{['Foto', 'Produto', 'Público', 'Categoria', 'Marca', 'Preço', 'Estoque', 'Status', ''].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{products.map((product) => <tr key={product.id}>
          <td className="px-4 py-3"><div className="relative h-14 w-14 overflow-hidden rounded-lg bg-[#F7F0E7]">{product.imagem_principal && <Image src={product.imagem_principal} alt="" fill sizes="56px" className="object-cover" />}</div></td>
          <td className="px-4 py-3"><b>{product.nome}</b><small className="block text-[#6E625A]">{product.codigo_produto}</small></td>
          <td className="px-4 py-3">{product.publico}</td><td className="px-4 py-3">{product.categoria}</td><td className="px-4 py-3">{product.marca || 'Indefinida'}</td>
          <td className="px-4 py-3">{product.em_promocao && product.preco_promocional !== null ? <><s className="block text-xs">{money(product.preco)}</s><b>{money(product.preco_promocional)}</b></> : money(product.preco)}</td>
          <td className="px-4 py-3">{product.estoque.reduce((sum, item) => sum + item.quantidade, 0)}</td>
          <td className="px-4 py-3">{product.ativo ? 'Ativo' : 'Inativo'}</td><td className="px-4 py-3"><button onClick={() => edit(product)} className="font-bold text-[#C8722C]">Editar</button></td>
        </tr>)}</tbody></table>
    </div>
    {open && <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#241C17]/60 p-3 sm:p-8">
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-5 sm:p-7">
        <div className="flex justify-between"><div><h2 className="text-2xl font-bold">{editing ? 'Editar produto' : 'Novo produto'}</h2><p className="text-sm text-[#6E625A]">Campos com * são obrigatórios.</p></div><button type="button" onClick={() => setOpen(false)} className="h-10 w-10 rounded-full bg-[#F7F0E7]">×</button></div>
        <Field label="Nome *"><input value={form.nome} onChange={(e) => update('nome', e.target.value)} required className="input" /></Field>
        <Field label="Público *"><select value={form.publico} onChange={(e) => update('publico', e.target.value)} required className="input"><option value="">Selecione</option>{publics.map((item) => <option key={item}>{item}</option>)}</select></Field>
        <Field label="Categoria *"><select value={form.categoria_id} onChange={(e) => update('categoria_id', e.target.value)} required className="input"><option value="">Selecione</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Marca"><select value={form.marca_id} onChange={(e) => update('marca_id', e.target.value)} className="input"><option value="">Indefinida (padrão)</option>{brands.filter((b) => b.nome.toLowerCase() !== 'indefinida').map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Preço *"><input type="number" min="0" step="0.01" value={form.preco} onChange={(e) => update('preco', e.target.value)} required className="input" /></Field>
        <Toggle label="Produto em promoção" checked={form.promocao} onChange={(v) => update('promocao', v)} />
        {form.promocao && <Field label="Preço promocional *"><input type="number" min="0" step="0.01" value={form.promocional} onChange={(e) => update('promocional', e.target.value)} required className="input" /></Field>}
        <Toggle label="Produto ativo" checked={form.ativo} onChange={(v) => update('ativo', v)} />
        <section><h3 className="mb-3 text-lg font-bold">Tamanhos e estoque</h3><div className="flex flex-col gap-2 sm:flex-row">
          {!noSelector && <select value={size} onChange={(e) => setSize(e.target.value)} className="input flex-1"><option value="">Tamanho</option>{sizes.map((item) => <option key={item}>{item}</option>)}</select>}
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantidade" className="input flex-1" /><button type="button" onClick={addStock} className="rounded-lg border px-5 font-bold">Adicionar</button>
        </div><div className="mt-3 flex flex-wrap gap-2">{stock.map((item) => <span key={item.tamanho} className="rounded-full bg-[#F7F0E7] px-3 py-2 text-sm">{item.tamanho}: {item.quantidade} <button type="button" onClick={() => setStock((s) => s.filter((x) => x !== item))} className="ml-2 font-bold">×</button></span>)}</div></section>
        <section><h3 className="text-lg font-bold">Galeria de fotos</h3><p className="mb-3 text-sm text-[#6E625A]">A primeira foto é a principal. Arraste para reorganizar. Até 10 fotos.</p>
          <label onDragOver={(e) => e.preventDefault()} onDrop={dropFiles} className="block cursor-pointer rounded-xl border-2 border-dashed border-[#D9CEC2] p-7 text-center"><b>Arraste as fotos aqui</b><span className="block text-sm">ou clique para selecionar</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && addFiles(e.target.files)} className="sr-only" /></label>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{gallery.map((item, index) => <div key={item.key} draggable onDragStart={() => setDragIndex(index)} onDragOver={(e) => e.preventDefault()} onDrop={() => move(index)} className="relative aspect-square cursor-grab overflow-hidden rounded-xl border-2 bg-[#F7F0E7]">
            <Image src={item.url} alt="" fill sizes="160px" className="object-cover" unoptimized={Boolean(item.file)} />{index === 0 && <span className="absolute left-2 top-2 rounded bg-[#C8722C] px-2 py-1 text-xs font-bold text-white">Principal</span>}
            <button type="button" onClick={() => setGallery((g) => g.filter((x) => x !== item))} className="absolute right-2 top-2 h-7 w-7 rounded-full bg-white font-bold">×</button>
            {index > 0 && <button type="button" onClick={() => setGallery((g) => [item, ...g.filter((x) => x !== item)])} className="absolute bottom-2 left-2 right-2 rounded bg-white/95 px-2 py-1 text-xs font-bold">Definir principal</button>}
          </div>)}</div>
        </section>
        <Field label="Descrição"><textarea rows={8} value={form.descricao} onChange={(e) => update('descricao', e.target.value)} className="input resize-y" placeholder="Escreva a descrição em quantos parágrafos precisar." /></Field>
        <button disabled={saving} className="w-full rounded-xl bg-[#C8722C] py-4 font-bold text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
      </form>
    </div>}
  </AdminShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-xl border border-[#E7E0D8] p-4"><b>{label}</b><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#C8722C]" /></label>;
}
