import React from "react";
import { OrbiterMark, ProgressBar, StatusBadge } from "./ui.jsx";

const PRIORITY_ORDER = ["P0", "P1", "P2"];

function buildPriorityList(groupedPriorities) {
  return PRIORITY_ORDER.flatMap((priority) =>
    (groupedPriorities?.[priority] ?? []).map((item) => ({
      ...item,
      priority,
    })),
  ).slice(0, 10);
}

function extractEstimateNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function extractTaskCount(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function priorityFromImpact(impact) {
  if (impact === "高") return "P0";
  if (impact === "中") return "P1";
  return "P2";
}

function typeLabel(item) {
  if (String(item.type || "").includes("返修")) return "返修";
  if (String(item.status || "").includes("完成")) return "已完成";
  return "制作中";
}

function typeTone(item) {
  if (String(item.type || "").includes("返修")) return "danger";
  if (String(item.status || "").includes("完成")) return "neutral";
  return "good";
}

function workloadTone(item) {
  if (String(item.type || "").includes("返修")) return "warning";
  if (String(item.status || "").includes("超期")) return "danger";
  return "good";
}

function countSceneScope(scope) {
  if (!scope) return 0;
  return String(scope)
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean).length;
}

export default function OverviewView({
  project,
  stats,
  assets,
  risks,
  groupedPriorities,
  onOpenMember,
  onOpenStoryboard,
}) {
  const priorityItems = buildPriorityList(groupedPriorities);
  const criticalRisk = risks?.[0];
  const minorRisks = (risks ?? []).slice(1, 6);
  const maxEstimate = Math.max(...priorityItems.map((item) => extractEstimateNumber(item.estimate)), 1);
  const assetIssueSummary = {
    missingOwner: assets.filter((asset) => !String(asset.owner || "").trim()).length,
    pendingTotal: assets.reduce((sum, asset) => sum + (asset.pending ?? 0), 0),
  };

  return (
    <section className="project-view-stack overview-page">
      <div className="overview-signal-row">
        <article className="card overview-signal-card overview-signal-card-primary">
          <div className="overview-signal-head overview-signal-head-compact">
            <div>
              <span className="section-kicker">PRIMARY SIGNAL</span>
              <p className="signal-caption">飞书实时同步总览</p>
            </div>
            <span className="signal-fx-badge">
              <OrbiterMark tone="accent" small />
              飞书在线
            </span>
          </div>

          <div className="overview-signal-core overview-signal-core-balanced">
            <div className="overview-signal-main-stack">
              <strong className="overview-signal-figure overview-signal-figure-compact">{project.completionRate}%</strong>
              <p className="overview-signal-support overview-signal-support-aligned">
                {project.completedStoryboards}/{project.totalStoryboards} 镜
              </p>
            </div>

            <div className="signal-side-copy signal-side-copy-stacked">
              <div className="signal-side-item">
                <span>资产完成</span>
                <strong>{project.assetCompleted}</strong>
                <small>{project.assetTotal} 条已同步</small>
              </div>
              <div className="signal-side-item">
                <span>当前阶段</span>
                <strong>{project.currentStage}</strong>
                <small>{project.scriptProgress}</small>
              </div>
            </div>
          </div>

          <div className="signal-inline-metrics">
            <div className="signal-inline-metric">
              <span>环比昨日</span>
              <strong>
                {stats.yesterdayDeltaShots > 0 ? "+" : ""}
                {stats.yesterdayDeltaShots} 镜
              </strong>
              <small>
                {stats.yesterdayDeltaPercent > 0 ? "+" : ""}
                {stats.yesterdayDeltaPercent}%
              </small>
            </div>
            <div className="signal-inline-metric">
              <span>预计完成</span>
              <strong>{stats.estimatedCompletionDate || "--"}</strong>
              <small>{stats.estimatedDays ? `约 ${stats.estimatedDays} 天` : "等待更多进度"}</small>
            </div>
            <div className="signal-inline-metric">
              <span>同步状态</span>
              <strong>已同步定场图</strong>
              <small>
                {project.completedStoryboards}/{project.totalStoryboards}
              </small>
            </div>
          </div>

          <div className="hero-progress-line" aria-hidden="true">
            <span style={{ width: `${project.completionRate}%` }} />
          </div>
        </article>
      </div>

      <div className="overview-mid-grid overview-mid-grid-balanced">
        <article className="card section-card section-card-airy overview-priority-card overview-priority-card-equal">
          <div className="section-head section-head-compact section-head-tight">
            <div>
              <span className="section-kicker">TODAY PRIORITY</span>
              <h3>今日优先级</h3>
            </div>
            <div className="overview-total-number overview-total-number-compact">
              <strong>{priorityItems.length}</strong>
              <span>条任务</span>
            </div>
          </div>

          <div className="priority-meta-row">
            <span>执行团队</span>
            <strong>{stats.teamDailyTarget} 镜/日</strong>
          </div>

          <div className="priority-card-grid">
            {priorityItems.map((item) => {
              const estimateValue = extractEstimateNumber(item.estimate);
              const taskCount = extractTaskCount(item.task);
              const workloadRatio = Math.max(10, Math.round((estimateValue / maxEstimate) * 100));
              const sceneCount = countSceneScope(item.scope);

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`priority-task-card tone-${item.priority.toLowerCase()}`}
                  onClick={() => onOpenMember?.(item.owner)}
                >
                  <div className="priority-task-card-top">
                    <StatusBadge value={item.priority} kind="priority" />
                    <div>
                      <strong>{item.owner}</strong>
                      <small>{item.group}</small>
                    </div>
                    <span className={`priority-count-bubble tone-${typeTone(item)}`}>
                      {typeLabel(item)} {taskCount || estimateValue}
                    </span>
                  </div>

                  <p className="priority-task-title">{item.task}</p>

                  <div className="priority-tag-row">
                    <span className="priority-inline-tag tone-neutral">{item.status}</span>
                    <span className={`priority-inline-tag tone-${typeTone(item)}`}>{typeLabel(item)}</span>
                  </div>

                  <div className="priority-task-load">
                    <div className={`priority-task-load-bar tone-${workloadTone(item)}`}>
                      <span style={{ width: `${workloadRatio}%` }} />
                    </div>
                    <strong>{estimateValue}</strong>
                  </div>

                  <small className="priority-task-scope">涉及 {sceneCount} 个场次</small>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card section-card section-card-airy assets-card">
          <div className="section-head section-head-compact section-head-tight">
            <div>
              <span className="section-kicker">ASSET MATRIX</span>
              <h3>资产统计</h3>
            </div>
            <p>基于飞书人物、场景、道具表的同步统计，并补进第一集定场图与场次规模。</p>
          </div>

          <div className="asset-stats-grid asset-stats-grid-wide">
            <div className="asset-stat-box">
              <span>总需求</span>
              <strong>{project.assetTotal}</strong>
            </div>
            <div className="asset-stat-box">
              <span>已完成</span>
              <strong>{project.assetCompleted}</strong>
            </div>
            <div className="asset-stat-box">
              <span>制作中</span>
              <strong>{assets.reduce((sum, asset) => sum + (asset.inProgress ?? 0), 0)}</strong>
            </div>
            <div className="asset-stat-box">
              <span>未开始</span>
              <strong>{assets.reduce((sum, asset) => sum + (asset.pending ?? 0), 0)}</strong>
            </div>
            <div className="asset-stat-box">
              <span>定场图数量</span>
              <strong>{project.totalStoryboards}</strong>
            </div>
            <div className="asset-stat-box">
              <span>第一集总场次</span>
              <strong>{project.sceneCount || assets.length}</strong>
            </div>
          </div>

          <div className="asset-alert-row">
            <span className="asset-alert-chip is-danger">待补负责人 {assetIssueSummary.missingOwner} 类</span>
            <span className="asset-alert-chip is-neutral">待启动 {assetIssueSummary.pendingTotal} 条</span>
          </div>

          <div className="asset-list">
            {assets.map((asset) => (
              <article key={asset.type} className="asset-row-card asset-row-card-horizontal">
                <div className="asset-row-head asset-row-head-compact">
                  <div>
                    <strong>{asset.type}</strong>
                    <small>{asset.owner || "待补充负责人"}</small>
                  </div>
                  {asset.priority ? <StatusBadge value={asset.priority} kind="priority" /> : null}
                </div>
                <div className="asset-row-track">
                  <ProgressBar value={asset.progress} compact />
                  <div className="asset-row-meta">
                    <span>{asset.progressLabel}</span>
                    <small>{asset.inProgress} 制作中</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>

      <article className="card section-card section-card-airy risk-row-card">
        <div className="section-head section-head-compact section-head-tight">
          <div>
            <span className="section-kicker">RISK RADAR</span>
            <h3>风险预警</h3>
          </div>
          <p>最严重风险单独高亮，其余按优先级紧凑展示。</p>
        </div>

        <div className="risk-row-layout">
          {criticalRisk ? (
            <article className="risk-signal-item risk-signal-item-critical">
              <span className="risk-signal-critical-icon">⚠️</span>
              <div className="risk-signal-critical-copy">
                <span className="section-kicker">Critical</span>
                <strong>{criticalRisk.id}</strong>
                <p>{criticalRisk.description}</p>
                <small className="risk-signal-foot">
                  <span>{criticalRisk.category}</span>
                  <span>{criticalRisk.response}</span>
                </small>
              </div>
              <div className="risk-signal-critical-side">
                <StatusBadge value={priorityFromImpact(criticalRisk.impact)} kind="priority" />
              </div>
            </article>
          ) : null}

          <div className="risk-signal-list risk-signal-list-compact">
            {minorRisks.map((risk) => (
              <article key={risk.id} className="risk-signal-item">
                <div className="risk-signal-top">
                  <div className="risk-signal-copy">
                    <strong>{risk.id}</strong>
                    <p>{risk.description}</p>
                  </div>
                  <StatusBadge value={priorityFromImpact(risk.impact)} kind="priority" />
                </div>
                <small className="risk-signal-foot">{risk.response}</small>
              </article>
            ))}
          </div>
        </div>

        <button type="button" className="button button-ghost" onClick={onOpenStoryboard}>
          查看分镜明细
        </button>
      </article>
    </section>
  );
}
