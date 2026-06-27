'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type DashboardData = {
  carts: { count: number; total: number };
  finance: { last15Days: number; month: number; today: number };
  orders: { averageFirstResponseMs: number; averageWaitMs: number; completed: number; open: number; waitingOpen: number };
  visits: { dailyAverage: number; error: string | null; last7Days: number; last30Days: number; today: number };
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

function VisitMetric({ label, loading, value }: { label: string; loading: boolean; value: string | number }) {
  return <article className="rounded-xl border border-[#E7E0D8] bg-[#F8F5F1] px-4 py-3.5">
    <p className="text-xs font-bold uppercase tracking-wide text-[#6E625A]">{label}</p>
    {loading
      ? <div className="mt-3 h-7 w-24 animate-pulse rounded-md bg-[#F7F0E7]" aria-label={`Carregando ${label}`} />
      : <p className="mt-2 text-2xl font-black tracking-tight text-[#241C17]">{value}</p>}
  </article>;
}

function VisitsMetrics({ data, loading }: { data: DashboardData['visits'] | undefined; loading: boolean }) {
  const average = (data?.dailyAverage ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return <section className="rounded-2xl border border-[#E2D7CC] bg-white p-4 shadow-[0_5px_16px_rgba(74,45,26,0.035)] sm:p-5">
    <div className="mb-4 flex items-center gap-3">
      <SmallIcon tone="neutral"><><path d="M3 12h3l2.2-5 3.5 10 2.5-6 2 3H21" /></></SmallIcon>
      <SectionHeading subtitle="Visitantes únicos registrados pela loja.">Visitas</SectionHeading>
    </div>
    {data?.error && <p className="admin-visits-warning mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Não foi possível atualizar as visitas. Os demais indicadores continuam disponíveis.</p>}
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
      <VisitMetric label="Hoje" loading={loading} value={data?.today ?? 0} />
      <VisitMetric label="Últimos 7 dias" loading={loading} value={data?.last7Days ?? 0} />
      <VisitMetric label="Últimos 30 dias" loading={loading} value={data?.last30Days ?? 0} />
      <VisitMetric label="Média diária" loading={loading} value={`${average} visitas/dia`} />
    </div>
  </section>;
}

export default function AdminDashboard() {
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
        const response = await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } });
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
  }, []);
  const display = (value: string | number) => loading ? '...' : value;

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;

  return <div className="mx-auto max-w-7xl space-y-8 pb-5">
    <section className="space-y-4"><SectionHeading subtitle="Acompanhamento dos pedidos enviados pelos clientes.">Pedidos</SectionHeading><div className="grid gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4"><MetricCard label="Pedidos em aberto" value={display(data?.orders.open ?? 0)} helper="Aguardando atendimento" tone="amber" icon={<><path d="M12 7v5l3 2" /><circle cx="12" cy="12" r="8.5" /></>} /><MetricCard label="Pedidos concluídos" value={display(data?.orders.completed ?? 0)} helper="Pedidos finalizados" tone="green" icon={<><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.3 2.3 4.8-5" /></>} /><MetricCard label="Primeira resposta" value={display(formatWait(data?.orders.averageFirstResponseMs ?? 0))} helper="Média dos pedidos já atendidos" tone="green" icon={<><path d="M5 12h10M11 8l4 4-4 4" /><path d="M19 5v14" /></>} /><MetricCard label="Tempo médio de espera" value={display(formatWait(data?.orders.averageWaitMs ?? 0))} helper={`${display(data?.orders.waitingOpen ?? 0)} pedido(s) ainda sem resposta`} tone="amber" icon={<><path d="M12 7v5M9.5 3.8h5" /><circle cx="12" cy="13" r="7.5" /></>} /></div></section>

    <section className="space-y-4"><SectionHeading subtitle="Valores reais das vendas com status concluído.">Resumo financeiro</SectionHeading><div className="grid gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3"><MetricCard label="Vendas de hoje" value={display(brlFormatter.format(data?.finance.today ?? 0))} helper="Concluídas desde o início do dia" tone="caramel" icon={<><path d="M6 8.5h12M6 15.5h12M9 5v14M15 5v14" /></>} /><MetricCard label="Últimos 15 dias" value={display(brlFormatter.format(data?.finance.last15Days ?? 0))} helper="Total concluído no período" tone="caramel" icon={<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>} /><MetricCard label="Mês atual" value={display(brlFormatter.format(data?.finance.month ?? 0))} helper="Do primeiro dia até hoje" tone="caramel" icon={<><path d="M4 18V8M10 18V4M16 18v-7M22 18H2" /></>} /></div></section>

    <section className="rounded-2xl border border-[#E2D7CC] bg-white p-4 shadow-[0_5px_16px_rgba(74,45,26,0.035)] sm:p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><SmallIcon tone="neutral"><><path d="M3.5 5h2l2 10h10l2-7H7" /><circle cx="9" cy="19" r="1.2" /><circle cx="17" cy="19" r="1.2" /></></SmallIcon><SectionHeading subtitle="Carrinhos ainda não enviados ou finalizados.">Carrinhos abertos</SectionHeading></div><div className="grid grid-cols-2 gap-5 sm:flex sm:items-center sm:gap-8"><div><p className="text-xs text-[#6E625A]">Quantidade</p><p className="mt-1 text-2xl font-black text-[#241C17]">{display(data?.carts.count ?? 0)}</p></div><div><p className="text-xs text-[#6E625A]">Valor total</p><p className="mt-1 text-xl font-black text-[#4A2D1A]">{display(brlFormatter.format(data?.carts.total ?? 0))}</p></div></div><Link href="/admin/vendas/carrinhos-abertos" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#C9B5A5] px-4 py-2 text-sm font-semibold text-[#4A2D1A] transition hover:bg-[#F7F0E7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8722C]">Ver carrinhos</Link></div></section>

    <VisitsMetrics data={data?.visits} loading={loading} />
  </div>;
}
