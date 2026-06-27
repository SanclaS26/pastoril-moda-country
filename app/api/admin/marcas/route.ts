import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const onlyActive = new URL(request.url).searchParams.get('ativo') === 'true';
  let query = auth.supabaseAdmin.from('marcas').select('*');
  if (onlyActive) query = query.eq('ativo', true);
  const { data, error } = await query.order('nome');
  if (error) return NextResponse.json({ error: `Erro ao listar marcas: ${error.message}` }, { status: 500 });
  return NextResponse.json({ marcas: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  const { data, error } = await auth.supabaseAdmin.from('marcas').insert({ nome, ativo: body.ativo !== false }).select().single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Já existe uma marca com este nome.' : error.message }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
