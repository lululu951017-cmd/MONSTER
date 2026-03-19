# Cloudflare Pages Deploy

This project is prepared for Cloudflare Pages.

Project name:

- `monster-production-hub-951017`

Commands:

- Create project: `npm run cf:project:create`
- Deploy current build: `npm run cf:deploy`
- Preview with Pages runtime: `npm run cf:dev`

First-time setup:

1. Run `npx wrangler login`
2. Run `npm run cf:project:create`
3. Run `npm run cf:deploy`

If the project name is already taken in your account, edit:

- `wrangler.toml`
- `package.json`

GitHub auto deploy:

1. In Cloudflare, create a Pages API token with `Account / Cloudflare Pages / Edit`
2. Copy your `Account ID`
3. In GitHub repo secrets, add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Push to `claude/add-chart-components-Cqdu3`

Workflow file:

- `.github/workflows/deploy-cloudflare-pages.yml`
