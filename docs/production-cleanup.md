# Limpeza de dados de producao

Esta operacao apaga os dados atuais do sistema e preserva tabelas, colunas,
constraints, indices, sequences, RLS, policies, funcoes, triggers, buckets,
APIs e paginas. Ela nao deve ser executada sem backup validado.

O script SQL e a rota de Auth sao destrutivos. Nenhum deles e executado
automaticamente pelo projeto.

## Dados abrangidos

O arquivo `scripts/production-cleanup.sql` limpa estas tabelas reais:

- `public.venda_estoque_movimentos`
- `public.venda_itens`
- `public.vendas`
- `public.itens_pedido`
- `public.pedidos`
- `public.wishlist_items`
- `public.estoque_produtos`
- `public.produtos`
- `public.categorias`
- `public.departamentos`
- `public.banners`
- `public.clientes`
- `public.admin_users`
- `public.site_visits`
- `public.whatsapp_atendimento_sessoes`

O schema ainda possui as tabelas legadas `public.pedidos` e
`public.itens_pedido`, e ambas tambem sao limpas. O fluxo atual de pedidos e
carrinhos usa `public.vendas`. Nao existem tabelas separadas de perfis ou
imagens: os perfis ficam em `public.clientes` e `public.admin_users`; tamanhos
ficam em `public.estoque_produtos`; referencias de imagens ficam em
`public.produtos` e `public.banners`.

`public.erp_integrations` e preservada porque contem configuracao operacional.

## Antes de comecar

1. Interrompa cadastros e operacoes administrativas durante a manutencao.
2. Gere um backup completo do banco no Supabase e confirme que ele pode ser
   restaurado.
3. Registre em commit as alteracoes de codigo e migrations que devem ir para
   producao.
4. Confirme que `ADMIN_BOOTSTRAP_SECRET` esta configurada no ambiente da API.
5. Guarde o segredo apenas em local seguro. Nao o registre em commits, logs ou
   capturas de tela.

## Sequencia recomendada

### 1. Executar o SQL

Abra o **Supabase SQL Editor**, revise `scripts/production-cleanup.sql` e execute
o conteudo completo. O script usa uma transacao e um `TRUNCATE` coordenado para
respeitar as chaves estrangeiras e evitar os triggers que proíbem `DELETE` no
historico de vendas.

O script usa `CONTINUE IDENTITY`: as sequences e seus valores atuais sao
preservados. Ele nao usa `DROP TABLE`, nao altera o schema e nao acessa
`auth.users` nem `storage.objects`.

### 2. Limpar o Supabase Auth

Depois do SQL, chame a rota server-side:

```bash
curl -X POST https://www.pastoril.com.br/api/admin/maintenance/cleanup-auth \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": "APAGAR_USUARIOS_DE_TESTE",
    "secret": "SEU_ADMIN_BOOTSTRAP_SECRET"
  }'
```

Para teste local, troque a origem por `http://localhost:3000`.

A rota usa o Supabase Admin somente no servidor e remove todos os usuarios do
Supabase Auth. Ela nao depende de uma sessao de administrador: a requisicao ja
autorizada pelo segredo termina antes de ser necessario recriar o acesso.

Execute essa etapa antes do bootstrap. Nao use a rota depois de criar o novo
administrador, pois ela tambem removeria esse usuario.

Se a resposta indicar falha parcial, nao prossiga silenciosamente. Revise a
quantidade retornada, consulte os usuarios restantes no painel do Supabase e
repita a operacao somente depois de entender a falha.

### 3. Recriar o primeiro administrador

Acesse:

```text
https://www.pastoril.com.br/admin/bootstrap
```

Em ambiente local:

```text
http://localhost:3000/admin/bootstrap
```

Crie o primeiro administrador e depois remova ou troque
`ADMIN_BOOTSTRAP_SECRET`, conforme descrito em `docs/admin-bootstrap.md`.

### 4. Validar e cadastrar os dados reais

1. Entre em `/admin/login` com o novo administrador.
2. Confirme que o painel abre e que nao ha dados antigos.
3. Cadastre departamentos e categorias reais.
4. Cadastre produtos e estoque por tamanho.
5. Cadastre os banners reais.
6. Teste catalogo, carrinho, WhatsApp e fluxo administrativo.

## Objetos do Supabase Storage

O SQL remove as referencias de banco, mas nao remove arquivos fisicos. Os
buckets usados pela aplicacao sao `produtos` e `banners`. Os buckets devem ser
preservados.

Para limpar os objetos com seguranca:

1. Conclua e valide o backup antes de apagar arquivos.
2. No painel do Supabase, abra **Storage** e selecione o bucket `produtos`.
3. Confira os caminhos e remova somente os objetos antigos.
4. Repita a conferencia no bucket `banners`.
5. Nao exclua os buckets, policies ou configuracoes de acesso.
6. Cadastre um produto e um banner de teste para validar upload e leitura.

Essa etapa e separada porque apagar linhas de `public.produtos` ou
`public.banners` nao apaga automaticamente os objetos armazenados.

## Reversao

O `COMMIT` torna a limpeza definitiva no banco atual. Para reverter:

1. Interrompa novas gravacoes.
2. Restaure o backup validado no Supabase.
3. Se os objetos de Storage tambem foram removidos, restaure-os a partir da
   copia de seguranca correspondente.
4. Confira os usuarios do Supabase Auth e recrie acessos que nao tenham sido
   cobertos pelo mecanismo de backup.
5. Teste `/admin/login`, produtos, estoque, vendas, banners e WhatsApp.
