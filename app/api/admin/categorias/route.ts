import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin-auth';
import type { CategoriaTipoGrade } from '@/lib/supabase-admin';

const TIPOS_GRADE = new Set<CategoriaTipoGrade>(['roupas', 'calcados', 'chapeus_bones', 'cintos', 'unico']);

export async function GET(request: Request) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const onlyActive = new URL(request.url).searchParams.get('ativo') === 'true';
  let query = auth.supabaseAdmin.from('categorias').select('id, nome, ativo, ordem, tipo_grade, created_at, updated_at');
  if (onlyActive) query = query.eq('ativo', true);
  const { data, error } = await query.order('ordem', { ascending: true, nullsFirst: false }).order('nome');
  if (error) return NextResponse.json({ error: `Erro ao listar categorias: ${error.message}` }, { status: 500 });
  return NextResponse.json({ categorias: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveAdmin(request);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const tipoGrade = typeof body.tipo_grade === 'string' ? body.tipo_grade as CategoriaTipoGrade : 'unico';
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  if (!TIPOS_GRADE.has(tipoGrade)) return NextResponse.json({ error: 'Tipo de grade inválido.' }, { status: 400 });
  const { data, error } = await auth.supabaseAdmin
    .from('categorias').insert({ nome, tipo_grade: tipoGrade, ativo: body.ativo !== false, ordem: null, departamento_id: null }).select().single();
  if (error) {
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: status === 409 ? 'Já existe uma categoria com este nome.' : error.message }, { status });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}
