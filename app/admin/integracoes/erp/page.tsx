'use client';

import { FormEvent, type ReactNode, useEffect, useState } from 'react';
import AdminShell from '@/app/admin/components/AdminShell';
import { supabase } from '@/lib/supabase';
import { useProtectedRoute } from '@/lib/useAuth';

type EnvironmentValue = 'Producao' | 'Homologacao' | 'Sandbox';
type AuthType = 'API Key' | 'Bearer Token' | 'OAuth 2.0' | 'Usuario e senha' | 'Ainda nao definido';

type ErpForm = {
  erp_name: string;
  provider_name: string;
  api_base_url: string;
  api_version: string;
  environment: EnvironmentValue;
  auth_type: AuthType;
  sync_interval_minutes: string;
  sync_products: boolean;
  sync_categories: boolean;
  sync_prices: boolean;
  sync_images: boolean;
  sync_stock: boolean;
  send_confirmed_sales: boolean;
};

type ErpIntegrationResponse = Partial<ErpForm> & {
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  last_sync_error?: string | null;
};

const emptyForm: ErpForm = {
  api_base_url: '',
  api_version: '',
  auth_type: 'Ainda nao definido',
  environment: 'Homologacao',
  erp_name: '',
  provider_name: '',
  send_confirmed_sales: false,
  sync_categories: false,
  sync_images: false,
  sync_interval_minutes: '10',
  sync_prices: false,
  sync_products: false,
  sync_stock: false,
};

const environmentOptions: Array<{ label: string; value: EnvironmentValue }> = [
  { label: 'Produção', value: 'Producao' },
  { label: 'Homologação', value: 'Homologacao' },
  { label: 'Sandbox', value: 'Sandbox' },
];

const authOptions: Array<{ label: string; value: AuthType }> = [
  { label: 'API Key', value: 'API Key' },
  { label: 'Bearer Token', value: 'Bearer Token' },
  { label: 'OAuth 2.0', value: 'OAuth 2.0' },
  { label: 'Usuário e senha', value: 'Usuario e senha' },
  { label: 'Ainda não definido', value: 'Ainda nao definido' },
];

async function getSessionToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error('Sessão administrativa inválida ou expirada. Faça login novamente.');
  }

  return data.session.access_token;
}

function fieldClass(extra = '') {
  return `w-full rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm text-[#241C17] outline-none transition focus:border-[#C8722C] focus:ring-2 focus:ring-[#C8722C]/20 disabled:cursor-not-allowed disabled:bg-[#F1EAE2] disabled:text-[#8A7B70] ${extra}`;
}

function mapIntegrationToForm(integration: ErpIntegrationResponse | null): ErpForm {
  if (!integration) return emptyForm;

  return {
    ...emptyForm,
    api_base_url: integration.api_base_url ?? '',
    api_version: integration.api_version ?? '',
    auth_type: integration.auth_type ?? emptyForm.auth_type,
    environment: integration.environment ?? emptyForm.environment,
    erp_name: integration.erp_name ?? '',
    provider_name: integration.provider_name ?? '',
    send_confirmed_sales: Boolean(integration.send_confirmed_sales),
    sync_categories: Boolean(integration.sync_categories),
    sync_images: Boolean(integration.sync_images),
    sync_interval_minutes: String(integration.sync_interval_minutes ?? 10),
    sync_prices: Boolean(integration.sync_prices),
    sync_products: Boolean(integration.sync_products),
    sync_stock: Boolean(integration.sync_stock),
  };
}

export default function AdminErpIntegrationPage() {
  useProtectedRoute();

  const [form, setForm] = useState<ErpForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchIntegration = async () => {
      try {
        setLoading(true);
        const token = await getSessionToken();
        const response = await fetch('/api/admin/integracoes/erp', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Falha ao carregar a configuração ERP.');
        }

        setForm(mapIntegrationToForm(data.integration ?? null));
        setError('');
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Erro ao carregar a configuração ERP.');
      } finally {
        setLoading(false);
      }
    };

    void fetchIntegration();
  }, []);

  const updateField = <K extends keyof ErpForm>(field: K, value: ErpForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setMessage('');
      setError('');
      const token = await getSessionToken();
      const response = await fetch('/api/admin/integracoes/erp', {
        body: JSON.stringify({
          ...form,
          sync_interval_minutes: Number(form.sync_interval_minutes),
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao salvar configuração ERP.');
      }

      setForm(mapIntegrationToForm(data.integration ?? null));
      setMessage('Configuração não sensível salva com sucesso.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar configuração ERP.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Integração com ERP"
      subtitle="Configure os dados necessários para conectar o sistema Pastoril Moda Country ao sistema de gestão da loja física."
      active="erp"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          A integração ainda não está ativa. Esta área está sendo preparada para a futura conexão com o ERP.
        </div>

        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <Section title="Status da integração">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusItem label="Status" value="Não configurada" tone="warning" />
            <StatusItem label="ERP conectado" value="Nenhum" />
            <StatusItem label="Última sincronização" value="Nunca" />
            <StatusItem label="Último resultado" value="Nenhuma sincronização realizada" />
          </div>
        </Section>

        <Section title="Identificação do ERP">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do ERP">
              <input value={form.erp_name} onChange={(event) => updateField('erp_name', event.target.value)} className={fieldClass()} disabled={loading} />
            </Field>
            <Field label="Empresa fornecedora">
              <input value={form.provider_name} onChange={(event) => updateField('provider_name', event.target.value)} className={fieldClass()} disabled={loading} />
            </Field>
            <Field label="URL base da API">
              <input value={form.api_base_url} onChange={(event) => updateField('api_base_url', event.target.value)} className={fieldClass()} disabled={loading} placeholder="https://..." />
            </Field>
            <Field label="Versão da API">
              <input value={form.api_version} onChange={(event) => updateField('api_version', event.target.value)} className={fieldClass()} disabled={loading} />
            </Field>
            <Field label="Ambiente">
              <select value={form.environment} onChange={(event) => updateField('environment', event.target.value as EnvironmentValue)} className={fieldClass()} disabled={loading}>
                {environmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Autenticação">
          <div className="space-y-4">
            <Field label="Tipo de autenticação">
              <select value={form.auth_type} onChange={(event) => updateField('auth_type', event.target.value as AuthType)} className={fieldClass()} disabled={loading}>
                {authOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {['API Key', 'Token', 'Client ID', 'Client Secret', 'Usuário da API', 'Senha da API'].map((label) => (
                <Field key={label} label={label}>
                  <input
                    type="password"
                    value=""
                    readOnly
                    disabled
                    className={fieldClass()}
                    placeholder="Disponível quando a integração segura for implementada"
                  />
                </Field>
              ))}
            </div>

            <p className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm text-[#6E625A]">
              Credenciais serão armazenadas somente pelo servidor com proteção adequada quando a API for implementada. Nenhuma chave, token, senha ou Client Secret é salva nesta etapa.
            </p>
          </div>
        </Section>

        <Section title="Sincronização">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <Field label="Intervalo de sincronização em minutos">
              <input
                type="number"
                min={1}
                max={1440}
                value={form.sync_interval_minutes}
                onChange={(event) => updateField('sync_interval_minutes', event.target.value)}
                className={fieldClass()}
                disabled={loading}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Toggle label="Sincronizar produtos" checked={form.sync_products} onChange={(value) => updateField('sync_products', value)} disabled={loading} />
              <Toggle label="Sincronizar categorias" checked={form.sync_categories} onChange={(value) => updateField('sync_categories', value)} disabled={loading} />
              <Toggle label="Sincronizar preços" checked={form.sync_prices} onChange={(value) => updateField('sync_prices', value)} disabled={loading} />
              <Toggle label="Sincronizar fotos" checked={form.sync_images} onChange={(value) => updateField('sync_images', value)} disabled={loading} />
              <Toggle label="Sincronizar estoque por tamanho" checked={form.sync_stock} onChange={(value) => updateField('sync_stock', value)} disabled={loading} />
              <Toggle label="Enviar vendas confirmadas ao ERP" checked={form.send_confirmed_sales} onChange={(value) => updateField('send_confirmed_sales', value)} disabled={loading} />
            </div>
          </div>
          <p className="mt-4 rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm text-[#6E625A]">
            A baixa de estoque no ERP somente poderá ocorrer após a confirmação da venda no painel administrativo.
          </p>
        </Section>

        <Section title="Ações">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={loading || saving}
              className="rounded-lg bg-[#C8722C] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_18px_rgba(200,114,44,0.18)] transition hover:bg-[#4A2D1A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar configuração'}
            </button>
            <button type="button" disabled title="Disponível após a implementação da API" className="rounded-lg border border-[#E7E0D8] px-6 py-3 text-sm font-bold text-[#6E625A] opacity-60">
              Testar conexão
            </button>
            <button type="button" disabled title="Disponível após a implementação da API" className="rounded-lg border border-[#E7E0D8] px-6 py-3 text-sm font-bold text-[#6E625A] opacity-60">
              Sincronizar agora
            </button>
          </div>
          <p className="mt-3 text-sm text-[#6E625A]">Testar conexão e sincronizar agora estarão disponíveis após a implementação da API.</p>
        </Section>
      </form>
    </AdminShell>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-[#E7E0D8] bg-white p-4 shadow-[0_8px_18px_rgba(74,45,26,0.04)] sm:p-5">
      <h2 className="text-base font-black text-[#241C17]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#4A2D1A]">{label}</span>
      {children}
    </label>
  );
}

function StatusItem({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warning' }) {
  return (
    <div className="rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone === 'warning' ? 'bg-amber-500' : 'bg-[#7B8B58]'}`} aria-hidden="true" />
        <p className="text-xs font-bold uppercase text-[#6E625A]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-black text-[#241C17]">{value}</p>
    </div>
  );
}

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[#E7E0D8] bg-[#F9F6F1] px-4 py-3 text-sm font-bold text-[#4A2D1A]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#C7B8AA] text-[#C8722C] focus:ring-[#C8722C]"
      />
      <span>{label}</span>
    </label>
  );
}
