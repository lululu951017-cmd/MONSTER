# Vercel 正式发布流程

这份文档是《怪物制片台》的正式发布 SOP。

## 一句话流程

`同步飞书 -> 本地检查 -> Git 提交 -> 推送 -> Vercel 自动上线`

## 生产信息

- 生产地址：[https://monster-production-hub-951017.vercel.app](https://monster-production-hub-951017.vercel.app)
- 仓库：[https://github.com/lululu951017-cmd/MONSTER](https://github.com/lululu951017-cmd/MONSTER)
- 生产分支：`claude/add-chart-components-Cqdu3`

## 发布前准备

在项目根目录创建：

- `.env.local`

内容示例：

```bash
FEISHU_APP_ID=你的 App ID
FEISHU_APP_SECRET=你的 App Secret
FEISHU_BITABLE_APP_TOKEN=你的 Base Token
```

## 标准发布步骤

### 1. 拉最新代码

```bash
git pull
```

### 2. 同步飞书并构建

```bash
npm run release:prepare
```

这个命令会：

- 执行 `npm run sync:feishu:monster`
- 执行 `npm run build`

### 3. 本地打开检查

```bash
npm run dev
```

检查地址：

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

重点确认：

- 首页当前进度
- 今日优先级
- 资产统计
- 团队页
- 分镜页

### 4. 提交同步结果

```bash
git add -A
git commit -m "Update runtime dashboard data"
git push
```

### 5. 等待自动上线

推送到 `claude/add-chart-components-Cqdu3` 后，Vercel 会自动发布。

一般耗时：

- 1 到 2 分钟

线上地址：

- [https://monster-production-hub-951017.vercel.app](https://monster-production-hub-951017.vercel.app)

## 出问题时怎么排查

### 线上还是旧内容

先确认本地是否真的同步过飞书：

```bash
npm run sync:feishu:monster
```

再确认这个文件有更新：

- `public/monsterProjectDashboard.runtime.json`

然后确认是否已经提交并推送。

### Vercel 线上部署没更新

去 Vercel 项目页面检查最近一次 production deployment：

- 项目名：`monster-production-hub-951017`

### 飞书同步失败

优先检查：

- `.env.local` 是否存在
- `App ID / App Secret / Base Token` 是否正确
- 飞书应用是否有表格读取权限

## 当前策略

正式使用：

- Vercel 自动部署

备用：

- GitHub Pages

不再默认使用：

- Cloudflare Pages 自动工作流
