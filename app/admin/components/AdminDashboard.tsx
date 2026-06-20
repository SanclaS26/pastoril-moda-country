'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Period = '7' | '15' | 'month';
type DashboardData = {
  carts: { count: number; total: number };
  finance: { last15Days: number; month: number; today: number };
  orders: { averageWaitMs: number; completed: number; open: number };
  visits: Array<{ date: string; visits: number }>;
};
type Tone = 'amber' | 'caramel' | 'green' | 'neutral';

const brlFormatter = new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' });
const toneStyles: Record<Tone, { icon: string; surface: string }> = {
  amber: { icon: 'text-amber-700', surface: 'bg-amber-50/70' },
  caramel: { icon: 'text-[#9A5A2C]', surface: 'bg-[#F7EEE5]' },
  green: { icon: 'text-emerald-700', surface: 'bg-emerald-50/70' },
  neutral: { icon: 'text-[#6E625A]', surface: 'bg-[#F7F3EE]' },
};

function formatWait(milliseconds: number) {
  if (milliseconds <= 0) return 'Sem espera';
  const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) return `${totalHours}h${minutes ? ` ${minutes}min` : ''}`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days} ${days === 1 ? 'dia' : 'dias'}${hours ? ` e ${hours}h` : ''}`;
}

function SmallIcon({ children, tone }: { children: ReactNode; tone: Tone }) {
  const styles = toneStyles[tone];
  return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.surface} ${styles.icon}`}><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" aria-hidden="true">{children}</svg></span>;
}

function MetricCard({ helper, icon, label, tone, value }: { helper: string; icon: ReactNode; label: string; tone: Tone; value: string | number }) {
  return <article className="flex min-h-[138px] flex-col rounded-2xl border border-[#E7E0D8] bg-white p-4 shadow-[0_5px_16px_rgba(74,45,26,0.035)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-[#4A2D1A]">{label}</p><SmallIcon tone={tone}>{icon}</SmallIcon></div><p className="mt-3 truncate text-[1.75rem] font-black leading-none tracking-tight text-[#241C17]" title={String(value)}>{value}</p><p className="mt-auto pt-2 text-xs leading-relaxed text-[#6E625A]">{helper}</p></article>;
}

function SectionHeading({ children, subtitle }: { children: ReactNode; subtitle: string }) {
  return <div><h2 className="text-lg font-bold text-[#241C17]">{children}</h2><p className="mt-0.5 text-sm text-[#6E625A]">{subtitle}</p></div>;
}

function VisitsChart({ data }: { data: DashboardData['visits'] }) {
  const width = 680;
  const height = 220;
  const padding = { bottom: 30, left: 16, right: 12, top: 12 };
  const max = Math.max(...data.map((item) => item.visits), 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const points = data.map((item, index) => ({ ...item, x: padding.left + (data.length <= 1 ? innerWidth / 2 : index / (data.length - 1) * innerWidth), y: padding.top + innerHeight - item.visits / max * innerHeight }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = points.length ? `${line} L ${points.at(-1)?.x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z` : '';
  const labelStep = Math.max(1, Math.ceil(points.length / 6));

  return <svg viewBox={`0 0 ${width} ${height}`} className="block h-[190px] w-full sm:h-auto" role="img" aria-label="Gráfico de visitas únicas por dia">{Array.from({ length: 3 }, (_, index) => { const y = padding.top + innerHeight / 2 * index; return <line key={y} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#EEE8E1" strokeDasharray="4 7" />; })}{area && <path d={area} fill="#9A6A43" opacity="0.045" />}<path d={line} fill="none" stroke="#8A6B58" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <g key={point.date}><title>{`${point.date.slice(8, 10)}/${point.date.slice(5, 7)}: ${point.visits} visita${point.visits === 1 ? '' : 's'}`}</title><circle cx={point.x} cy={point.y} r="2.8" fill="#FFFDF9" stroke="#8A6B58" strokeWidth="1.5" />{(index === 0 || index === points.length - 1 || index % labelStep === 0) && <text x={point.x} y={height - 8} textAnchor="middle" fill="#82766E" fontSize="9">{point.date.slice(8, 10)}/{point.date.slice(5, 7)}</text>}</g>)}</svg>;
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>('7');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Sessão administrativa expirada.');
        const response = await fetch(`/api/admin/dashboard?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || 'Falha ao carregar dashboard.');
        setData(result as DashboardData);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar dashboard.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [period]);

  const periodButtons = useMemo(() => [{ id: '7' as const, label: '7 dias' }, { id: '15' as const, label: '15 dias' }, { id: 'month' as const, label: 'Mês atual' }], []);
  const display = (value: string | number) => loading ? '...' : value;

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;

  return <div className="mx-auto max-w-7xl space-y-8 pb-5">
    <section className="space-y-4"><SectionHeading subtitle="Acompanhamento dos pedidos enviados pelos clientes.">Pedidos</SectionHeading><div className="grid gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3"><MetricCard label="Pedidos em aberto" value={display(data?.orders.open ?? 0)} helper="Aguardando atendimento" tone="amber" icon={<><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8.5" /></>} /><MetricCard label="Pedidos concluídos" value={display(data?.orders.completed ?? 0)} helper="Pedidos finalizados" tone="green" icon={<><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.3 2.3 4.8-5" /></>} /><MetricCard label="Tempo médio de espera" value={display(formatWait(data?.orders.averageWaitMs ?? 0))} helper="Desde a criação dos pedidos abertos" tone="amber" icon={<><path d="M12 7v5M9.5 3.8h5" /><circle cx="12" cy="13" r="7.5" /></>} /></div></section>

    <section className="space-y-4"><SectionHeading subtitle="Valores reais das vendas com status concluído.">Resumo financeiro</SectionHeading><div className="grid gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3"><MetricCard label="Vendas de hoje" value={display(brlFormatter.format(data?.finance.today ?? 0))} helper="Concluídas desde o início do dia" tone="caramel" icon={<><path d="M6 8.5h12M6 15.5h12M9 5v14M15 5v14" /></>} /><MetricCard label="Últimos 15 dias" value={display(brlFormatter.format(data?.finance.last15Days ?? 0))} helper="Total concluído no período" tone="caramel" icon={<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>} /><MetricCard label="Mês atual" value={display(brlFormatter.format(data?.finance.month ?? 0))} helper="Do primeiro dia até hoje" tone="caramel" icon={<><path d="M4 18V8M10 18V4M16 18v-7M22 18H2" /></>} /></div></section>

    <section className="rounded-2xl border border-[#E2D7CC] bg-white p-4 shadow-[0_5px_16px_rgba(74,45,26,0.035)] sm:p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><SmallIcon tone="neutral"><><path d="M3.5 5h2l2 10h10l2-7H7" /><circle cx="9" cy="19" r="1.2" /><circle cx="17" cy="19" r="1.2" /></></SmallIcon><SectionHeading subtitle="Carrinhos ainda não enviados ou finalizados.">Carrinhos abertos</SectionHeading></div><div className="grid grid-cols-2 gap-5 sm:flex sm:items-center sm:gap-8"><div><p className="text-xs text-[#6E625A]">Quantidade</p><p className="mt-1 text-2xl font-black text-[#241C17]">{display(data?.carts.count ?? 0)}</p></div><div><p className="text-xs text-[#6E625A]">Valor total</p><p className="mt-1 text-xl font-black text-[#4A2D1A]">{display(brlFormatter.format(data?.carts.total ?? 0))}</p></div></div><Link href="/admin/vendas/carrinhos-abertos" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#C9B5A5] px-4 py-2 text-sm font-semibold text-[#4A2D1A] transition hover:bg-[#F7F0E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]">Ver carrinhos</Link></div></section>

    <section className="w-full max-w-[680px] rounded-2xl border border-[#E9E2DB] bg-white/80 p-3 shadow-[0_3px_10px_rgba(74,45,26,0.025)] sm:p-4"><div className="mb-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-[#3F3028]">Visitas</h2><p className="mt-0.5 text-xs text-[#756B64]">Visitantes únicos por dia.</p></div><div className="grid grid-cols-3 gap-1 rounded-lg bg-[#F8F5F1] p-0.5">{periodButtons.map((option) => <button key={option.id} type="button" onClick={() => setPeriod(option.id)} aria-pressed={period === option.id} className={`min-h-8 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${period === option.id ? 'border border-[#DDCFC3] bg-white text-[#4A2D1A]' : 'border border-transparent text-[#82766E] hover:text-[#4A2D1A]'}`}>{option.label}</button>)}</div></div>{loading || !data ? <p className="py-12 text-center text-xs text-[#756B64]">Carregando gráfico...</p> : <VisitsChart data={data.visits} />}</section>
  </div>;
}
