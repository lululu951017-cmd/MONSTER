# Feishu Sync Skeleton

This folder contains a Feishu Bitable sync skeleton that normalizes production data into the four dashboard schema keys:

- `studio-project`
- `studio-episodes`
- `studio-daily-logs`
- `studio-assets`

## Setup

1. Copy `config.example.json` to `config.local.json`.
2. Fill in your real Feishu table IDs and field names.
3. Set these environment variables:
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `FEISHU_BITABLE_APP_TOKEN`

You can also put them in the repo root `.env.local` file:

```bash
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BITABLE_APP_TOKEN=your_bitable_app_token
```

## Commands

Validate the config shape without calling Feishu:

```bash
npm run sync:feishu:validate
```

Run the actual sync:

```bash
npm run sync:feishu
```

List the available Feishu Bitable tables for your app token:

```bash
npm run sync:feishu:tables
```

Run the sync but skip file writes:

```bash
npm run sync:feishu -- --dry-run
```

You can provide either `tableId` or `tableName` in the config. The script will resolve table names automatically before fetching records.

## Output

The script writes normalized files to `public/studio-sync/`:

- `studio-project.json`
- `studio-episodes.json`
- `studio-daily-logs.json`
- `studio-assets.json`
- `studio-state.json`
- `manifest.json`

If browser storage is empty, the dashboard can bootstrap itself from `studio-state.json`.
