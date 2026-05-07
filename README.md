# MONSTER

《怪物》制片台前端项目，当前正式发布链路为：

`飞书同步 -> 本地验证 -> Git 提交/推送 -> Vercel 自动部署`

## 正式地址

- 生产环境：[https://monster-production-hub-951017.vercel.app](https://monster-production-hub-951017.vercel.app)
- 本地开发：[http://127.0.0.1:5173](http://127.0.0.1:5173)

## 当前数据来源

页面优先读取飞书同步产物：

- `public/monsterProjectDashboard.runtime.json`

当前已接入：

- 第一集定场图
- 人物资产
- 场景资产
- 道具资产

## 日常发布流程

### 1. 本地同步飞书

先准备根目录的 `.env.local`：

```bash
FEISHU_APP_ID=你的 App ID
FEISHU_APP_SECRET=你的 App Secret
FEISHU_BITABLE_APP_TOKEN=你的 Base Token
```

然后执行：

```bash
npm run release:prepare
```

这个命令会完成两件事：

- 同步飞书运行时数据
- 构建当前前端

### 2. 本地检查

```bash
npm run dev
```

打开：

[http://127.0.0.1:5173](http://127.0.0.1:5173)

确认以下内容无误：

- 当前进度
- 今日优先级
- 资产统计
- 团队与分镜详情

### 3. 提交并推送

```bash
git add -A
git commit -m "Update runtime dashboard data"
git push
```

### 4. 等待 Vercel 自动上线

Vercel 已绑定当前仓库与生产分支：

- 仓库：`lululu951017-cmd/MONSTER`
- 生产分支：`claude/add-chart-components-Cqdu3`

推送后会自动触发生产部署，通常 1 到 2 分钟内生效。

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run sync:feishu:monster
npm run release:prepare
```

## 目录说明

- `src/components/Dashboard.jsx`
- `src/components/dashboard/`
- `src/components/dashboardModel.js`
- `public/monsterProjectDashboard.runtime.json`
- `scripts/feishu-sync/export-monster-scene-runtime.js`

## 部署说明

当前正式使用：

- Vercel Git 自动部署

保留但不作为默认发布链路：

- GitHub Pages
- Cloudflare Pages（仅手动排障时再用）
