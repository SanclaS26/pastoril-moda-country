# Bootstrap do primeiro administrador

A rota `POST /api/admin/bootstrap` cria ou reativa um acesso no Supabase Auth e
sincroniza o registro correspondente em `public.admin_users`. Ela usa o
`service_role` somente no servidor e nunca retorna tokens.

## 1. Gerar o segredo

Gere um valor aleatorio forte. Por exemplo:

```bash
openssl rand -hex 32
```

No PowerShell, uma alternativa e:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

Nao reutilize uma senha pessoal e nao versione o valor.

## 2. Configurar o ambiente

Adicione o segredo ao `.env.local` apenas na sua maquina:

```dotenv
ADMIN_BOOTSTRAP_SECRET=valor_aleatorio_gerado
```

Reinicie o servidor local depois da alteracao. Na Vercel, cadastre a mesma
variavel em **Project Settings > Environment Variables** somente nos ambientes
em que o bootstrap sera executado e faca um novo deploy.

As variaveis `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` tambem
precisam estar configuradas no servidor, conforme a configuracao normal do
projeto. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em variavel `NEXT_PUBLIC_*`.

## 3. Chamar localmente

Com o projeto em execucao, envie:

```bash
curl -X POST http://localhost:3000/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "valor_aleatorio_gerado",
    "email": "admin@exemplo.com",
    "password": "uma-senha-forte",
    "nome": "Administrador Pastoril",
    "celular": "34999999999"
  }'
```

`celular` e opcional. Se ja houver um administrador ativo, a rota responde com
conflito. Para confirmar conscientemente uma nova execucao, inclua:

```json
{
  "force": true
}
```

Mantenha os demais campos do exemplo na mesma requisicao.

## 4. Desativar depois do uso

Depois de criar o administrador:

1. Remova `ADMIN_BOOTSTRAP_SECRET` do `.env.local`.
2. Remova a variavel dos ambientes da Vercel.
3. Reinicie o servidor local ou faca um novo deploy.

Sem essa variavel, a rota responde como indisponivel e nao executa nenhuma
operacao.

## 5. Conferir o acesso

Acesse `/admin/login`, entre com o e-mail e a senha usados no bootstrap e
confirme que o painel administrativo e carregado.
