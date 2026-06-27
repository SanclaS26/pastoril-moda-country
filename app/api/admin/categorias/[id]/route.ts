import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: { nome?: string; ativo?: boolean } = {};
  if (typeof body.nome === 'string') {
    if (!body.nome.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    update.nome = body.nome.trim();
  }
  if (typeof body.ativo === 'boolean') update.ativo = body.ativo;
  const { data, error } = await auth.supabaseAdmin.from('categorias').update(update).eq('id', Number(id)).select().single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Já existe uma categoria com este nome.' : error.message }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  const categoryId = Number(id);
  const { count, error: countError } = await auth.supabaseAdmin.from('produtos').select('id', { count: 'exact', head: true }).eq('categoria_id', categoryId);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (count) return NextResponse.json({ error: 'Não é possível excluir: existem produtos utilizando esta categoria.' }, { status: 409 });
  const { error } = await auth.supabaseAdmin.from('categorias').delete().eq('id', categoryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
