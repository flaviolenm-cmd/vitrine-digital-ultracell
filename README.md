# Vitrine Digital Ultracell Peças

Sistema web em HTML, CSS e JavaScript puro, com:
- login por perfil
- área do usuário
- painel administrativo
- catálogo, carrinho e pedidos
- entregas, devoluções e dashboard
- persistência em LocalStorage
- backup/restauração JSON
- exportação CSV de pedidos

## Como testar localmente
1. Extraia os arquivos.
2. Abra a pasta em um servidor local simples.
3. Exemplo com VS Code + Live Server, ou com Python:
   - `python -m http.server 8000`
4. Acesse `http://localhost:8000`

## Logins de demonstração
- Usuário: `12345678900` / `4567`
- ADM: `admin` / `1234`

## Estrutura
- `index.html`
- `css/style.css`
- `js/app.js`
- módulos em `js/modules`, `js/auth`, `js/ui`, `js/data`

## Observações
O sistema usa dados mockados iniciais e LocalStorage, ficando pronto para futura migração para backend e banco real.


## Cloudflare Pages + D1

Este projeto agora inclui uma base de migração para Cloudflare Pages + D1:
- `wrangler.jsonc`
- `functions/` com endpoints iniciais
- `migrations/` com schema e seed
- `docs/DEPLOY-CLOUDFLARE-D1.md` com passo a passo
- `scripts/backup-to-sql.mjs` para converter o backup JSON atual em SQL de importação
