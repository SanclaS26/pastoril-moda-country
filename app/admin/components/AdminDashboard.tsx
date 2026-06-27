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

const brlFormatter = new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' });

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

function formatCount(value: number) {
  return value.toLocaleString('pt-BR');
}

function SectionFrame({ children, subtitle, title }: { children: ReactNode; subtitle: string; title: string }) {
  return (
    <section className="admin-panel overflow-hidden rounded-[28px] shadow-[0_10px_28px_rgba(74,45,26,0.045)]">
      <header className="border-b border-[color:var(--admin-border)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[color:var(--admin-accent)]">{title}</p>
        <p className="mt-1 text-sm text-[color:var(--admin-muted)]">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

function RailStat({ helper, label, value, valueClassName = '' }: { helper?: string; label: string; value: string | number; valueClassName?: string }) {
  return (
    <div className="min-w-0 flex-1 border-t border-[color:var(--admin-border)] px-4 py-4 first:border-t-0 lg:border-l lg:border-t-0 lg:px-5 lg:py-5 lg:first:border-l-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">{label}</p>
      <p className={`mt-2.5 text-[clamp(1.35rem,2.2vw,2rem)] font-extrabold leading-none tracking-tight text-[color:var(--admin-text)] ${valueClassName}`.trim()} title={String(value)}>
        {value}
      </p>
      {helper ? <p className="mt-1.5 text-[0.8rem] leading-relaxed text-[color:var(--admin-muted)]">{helper}</p> : null}
    </div>
  );
}

function Rail({ items }: { items: Array<{ helper?: string; label: string; value: string | number; valueClassName?: string }> }) {
  return <div className="flex flex-col lg:flex-row">{items.map((item) => <RailStat key={item.label} {...item} />)}</div>;
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
  const display = (value: string | number) => (loading ? '...' : value);

  if (error) return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;

  return <div className="mx-auto max-w-7xl space-y-6 pb-6">
    <SectionFrame title="Visão geral" subtitle="Resumo executivo dos indicadores principais.">
      <Rail
        items={[
          { label: 'Pedidos em aberto', value: display(data?.orders.open ?? 0), helper: 'Aguardando atendimento' },
          { label: 'Pedidos concluídos', value: display(data?.orders.completed ?? 0), helper: 'Pedidos finalizados' },
          { label: 'Vendas hoje', value: display(brlFormatter.format(data?.finance.today ?? 0)), helper: 'Concluídas desde o início do dia', valueClassName: 'text-[color:var(--admin-accent)]' },
          { label: 'Mês atual', value: display(brlFormatter.format(data?.finance.month ?? 0)), helper: 'Do primeiro dia até hoje', valueClassName: 'text-[color:var(--admin-accent)]' },
          { label: 'Carrinhos abertos', value: display(formatCount(data?.carts.count ?? 0)), helper: 'Ainda sem finalização' },
          { label: 'Visitas hoje', value: display(formatCount(data?.visits.today ?? 0)), helper: 'Total registrado no dia' },
        ]}
      />
    </SectionFrame>

    <SectionFrame title="Pedidos" subtitle="Acompanhamento dos pedidos enviados pelos clientes.">
      <Rail
        items={[
          { label: 'Em aberto', value: display(formatCount(data?.orders.open ?? 0)), helper: 'Aguardando atendimento' },
          { label: 'Concluídos', value: display(formatCount(data?.orders.completed ?? 0)), helper: 'Pedidos finalizados' },
          { label: 'Primeira resposta', value: display(formatWait(data?.orders.averageFirstResponseMs ?? 0)), helper: 'Média dos pedidos já atendidos' },
          { label: 'Tempo médio de espera', value: display(formatWait(data?.orders.averageWaitMs ?? 0)), helper: `${display(formatCount(data?.orders.waitingOpen ?? 0))} pedido(s) ainda sem resposta` },
        ]}
      />
    </SectionFrame>

    <SectionFrame title="Financeiro" subtitle="Valores reais das vendas com status concluído.">
      <Rail
        items={[
          { label: 'Hoje', value: display(brlFormatter.format(data?.finance.today ?? 0)), helper: 'Concluídas desde o início do dia', valueClassName: 'text-[color:var(--admin-accent)]' },
          { label: 'Últimos 15 dias', value: display(brlFormatter.format(data?.finance.last15Days ?? 0)), helper: 'Total concluído no período', valueClassName: 'text-[color:var(--admin-accent)]' },
          { label: 'Mês atual', value: display(brlFormatter.format(data?.finance.month ?? 0)), helper: 'Do primeiro dia até hoje', valueClassName: 'text-[color:var(--admin-accent)]' },
        ]}
      />
    </SectionFrame>

    <section className="admin-panel overflow-hidden rounded-[28px] shadow-[0_10px_28px_rgba(74,45,26,0.045)]">
      <header className="border-b border-[color:var(--admin-border)] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[color:var(--admin-accent)]">Carrinhos abertos</p>
        <p className="mt-1 text-[0.8rem] text-[color:var(--admin-muted)]">Acompanhe os carrinhos que ainda não foram finalizados pelos clientes.</p>
      </header>
      <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:gap-8 lg:px-6">
        <div className="max-w-2xl flex-1">
          <p className="text-[0.8rem] leading-relaxed text-[color:var(--admin-muted)]">
            Uma visão direta da fila de carrinhos ainda em aberto, com o volume pendente e o valor total que aguarda conclusão.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px] lg:flex-none">
          <div className="admin-panel-soft rounded-2xl px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">Quantidade</p>
            <p className="mt-2.5 text-[clamp(1.35rem,2.2vw,1.9rem)] font-extrabold leading-none tracking-tight text-[color:var(--admin-text)]">{display(formatCount(data?.carts.count ?? 0))}</p>
          </div>
          <div className="admin-panel-soft rounded-2xl px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--admin-muted)]">Valor total</p>
            <p className="mt-2.5 text-[clamp(1.2rem,2vw,1.6rem)] font-extrabold leading-none tracking-tight text-[color:var(--admin-text)]">{display(brlFormatter.format(data?.carts.total ?? 0))}</p>
          </div>
        </div>
        <Link href="/admin/vendas/carrinhos-abertos" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--admin-border)] px-5 py-2.5 text-[0.8rem] font-semibold text-[color:var(--admin-text)] transition hover:bg-[color:var(--admin-surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--admin-accent)] lg:ml-auto">Ver carrinhos</Link>
      </div>
    </section>
  </div>;
}
