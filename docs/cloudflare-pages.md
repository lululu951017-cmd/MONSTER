# Cloudflare Pages 说明

Cloudflare Pages 当前**不是《怪物制片台》的正式发布链路**。

原因：

- 本地 Wrangler OAuth 刷新失败
- GitHub Actions 里的 Cloudflare 自动部署长期失败
- 当前团队已经切换到 **Vercel Git 自动部署** 作为正式方案

## 当前正式方案

请改看：

- [publish-vercel.md](E:/MONSTER/docs/publish-vercel.md)

## 这个文件保留的意义

仅用于以后重新排查 Cloudflare 时参考。

## 如果未来要重新启用 Cloudflare

至少需要先补齐：

1. 一个可用的 `CLOUDFLARE_API_TOKEN`
2. GitHub 仓库 Secret：
   - `CLOUDFLARE_API_TOKEN`
3. 重新验证工作流：
   - `.github/workflows/deploy-cloudflare-pages.yml`

## 当前建议

不要把 Cloudflare 作为日常更新入口。  
日常发布请直接使用 Vercel 正式链路。
