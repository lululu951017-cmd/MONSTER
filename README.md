# MONSTER

一个基于 Vite + React + Recharts 的 AI 漫剧制片工作台原型。

当前版本包含 3 个核心视图：

- 总览：8 集 × 7 工序热力图、7 日产出趋势、工序完成率、智能建议与提醒
- 分集：单集 7 工序详细状态与时间线、分集提醒
- 提醒：按紧急 / 警告 / 通知分级展示预警，并配套智能建议

页面同时预留了飞书多维表格接入思路：

- 7 张核心业务表联动
- 定时脚本拉取数据并计算状态变化、产出、滞留时长
- 规则引擎生成提醒与建议后回写

## 本地启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 代码入口

- `src/components/Dashboard.jsx`
- `src/App.jsx`

## 下一步建议

1. 把 `STAGES`、`EPISODES`、`DAILY_LOG`、`ALERTS`、`SUGGESTIONS` 抽成独立数据文件。
2. 为飞书多维表格准备一个后端或定时脚本层，统一计算状态与规则。
3. 把页面里的 mock data 替换成真实接口数据。
4. 继续拆分总览、分集、提醒三个视图组件，降低单文件复杂度。
