# Subir o projeto no Cloudflare Pages + D1

## 1) Instalar dependências
```bash
npm install
```

## 2) Login no Cloudflare
```bash
npx wrangler login
```

## 3) Criar o banco D1
```bash
npx wrangler d1 create vitrine-ultracell-db
```

Copie o `database_id` retornado e substitua em `wrangler.jsonc`.

## 4) Aplicar o schema
```bash
npx wrangler d1 migrations apply DB --remote
```

## 5) Popular com dados iniciais
```bash
npx wrangler d1 execute DB --remote --file=./migrations/0002_seed.sql
```

## 6) Testar localmente com Pages Functions + D1
```bash
npx wrangler pages dev . --d1 DB=SEU_DATABASE_ID
```

Abra o endereço local gerado pelo Wrangler.

## 7) Publicar no Cloudflare Pages
### Pelo GitHub
1. Suba este projeto para um repositório GitHub.
2. No Cloudflare Dashboard, entre em **Workers & Pages**.
3. Clique em **Create application** > **Pages** > **Connect to Git**.
4. Selecione o repositório.
5. Em **Build settings**, use:
   - Framework preset: `None`
   - Build command: vazio
   - Build output directory: `.`
6. Crie o projeto.

### Bind do D1 no Pages
Depois do projeto criado:
1. Abra o projeto Pages.
2. Vá em **Settings > Bindings**.
3. Clique em **Add > D1 database bindings**.
4. Variable name: `DB`
5. Escolha o banco `vitrine-ultracell-db`.
6. Faça **Redeploy** do projeto.

## 8) Se quiser importar o backup do sistema atual
1. No sistema atual, exporte o backup JSON.
2. Salve o arquivo como `backup.json` na raiz do projeto.
3. Gere SQL:
```bash
npm run backup:to-sql -- ./backup.json ./migrations/9999_import_from_backup.sql
```
4. Importe no D1:
```bash
npx wrangler d1 execute DB --remote --file=./migrations/9999_import_from_backup.sql
```

## 9) Próximo passo recomendado
Mover imagens para **R2** e salvar no D1 apenas a URL da imagem.
