import React from "react";
import { OrbiterMark, ProgressBar, StatusBadge } from "./ui.jsx";

const PRIORITY_ORDER = ["P0", "P1", "P2"];

function buildPriorityList(groupedPriorities) {
  return PRIORITY_ORDER.flatMap((priority) =>
    (groupedPriorities?.[priority] ?? []).map((item) => ({
      ...item,
      priority,
    })),
  ).slice(0, 8);
}

function extractEstimateNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? match[0] : "--";
}

function priorityFromImpact(impact) {
  if (impact === "高") return "P0";
  if (impact === "中") return "P1";
  return "P2";
}

export default function OverviewView({
  project,
  stats,
  assetSummary,
  assets,
  risks,
  groupedPriorities,
}) {
  const priorityItems = buildPriorityList(groupedPriorities);
  const criticalRisk = risks?.[0];
  const minorRisks = (risks ?? []).slice(1, 6);

  return (
    <section className="project-view-stack overview-page">
      <article className="card overview-signal-card overview-signal-card-wide">
        <div className="overview-signal-head overview-signal-head-compact">
          <div>
            <span className="section-kicker">PRIMARY SIGNAL</span>
            <p className="signal-caption">总进度与资产完成合并主卡</p>
          </div>
          <span className="signal-fx-badge">
            <OrbiterMark tone="accent" small />
            异类光彩
          </span>
        </div>

        <div className="overview-signal-core overview-signal-core-wide">
          <div className="overview-signal-main">
            <strong className="overview-signal-figure overview-signal-figure-compact">
              {project.completionRate}%
            </strong>
            <p className="overview-signal-support">
              {project.completedStoryboards}/{project.totalStoryboards} 镜
            </p>
          </div>

          <div className="signal-side-copy">
            <div className="signal-side-item">
              <span>资产完成</span>
              <strong>{project.assetCompleted}</strong>
              <small>{project.assetTotal} 总需求</small>
            </div>
            <div className="signal-side-item">
              <span>当前阶段</span>
              <strong>{project.currentStage}</strong>
              <small>{project.scriptProgress}</small>
            </div>
          </div>
        </div>

        <div className="overview-signal-inline-note">第 1 集 298 / 500 已完成</div>

        <div className="hero-progress-line" aria-hidden="true">
          <span style={{ width: `${project.completionRate}%` }} />
        </div>
      </article>

      <section className="overview-split-grid overview-mid-grid">
        <article className="section-card section-card-airy assets-card">
          <div className="section-head section-head-tight">
            <div>
              <span className="section-kicker">ASSET MATRIX</span>
              <h3>资产管理</h3>
            </div>
            <p>需求、完成、制作中与优先级一屏扫完。</p>
          </div>

          <div className="overview-team-summary-grid">
            <div className="soft-stat-widget">
              <span>总需求</span>
              <strong>{assetSummary.total}</strong>
            </div>
            <div className="soft-stat-widget">
              <span>已完成</span>
              <strong>{assetSummary.done}</strong>
            </div>
            <div className="soft-stat-widget">
              <span>制作中</span>
              <strong>{assetSummary.inProgress}</strong>
            </div>
            <div className="soft-stat-widget">
              <span>未开始</span>
              <strong>{assetSummary.pending}</strong>
            </div>
          </div>

          <div className="asset-widget-grid">
            {assets.map((asset) => (
              <article key={asset.type} className="asset-widget-card asset-widget-card-strong">
                <div className="asset-widget-top">
                  <div>
                    <strong>{asset.type}</strong>
                    <span>{asset.owner}</span>
                  </div>
                  <StatusBadge value={asset.priority} kind="priority" />
                </div>
                <ProgressBar value={asset.progress} compact />
                <div className="asset-widget-foot">
                  <span>
                    {asset.done}/{asset.total}
                  </span>
                  <span>{asset.inProgress} 制作中</span>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="section-card section-card-airy overview-priority-card overview-priority-card-equal">
          <div className="overview-priority-head">
            <div>
              <span className="section-kicker">TODAY PRIORITY</span>
              <h2>今日优先级</h2>
            </div>
            <div className="overview-priority-count">
              <strong>{project.priorityCount}</strong>
              <small>条任务</small>
            </div>
          </div>

          <div className="overview-priority-note">
            <span>执行团队</span>
            <strong>
              <em>{stats.teamDailyTarget}</em> 镜/日
            </strong>
          </div>

          <div className="priority-compact-list priority-compact-list-breathing">
            {priorityItems.map((item, index) => (
              <article key={item.id} className={`priority-compact-item ${index % 2 === 0 ? "is-even" : "is-odd"}`}>
                <div className="priority-compact-main">
                  <StatusBadge value={item.priority} kind="priority" />
                  <div>
                    <strong>{item.owner}</strong>
                    <p>{item.task}</p>
                  </div>
                </div>
                <div className="priority-compact-meta priority-compact-meta-strong">
                  <span
                    className={`priority-dot ${
                      item.priority === "P0" ? "is-danger" : item.priority === "P1" ? "is-warning" : "is-neutral"
                    }`}
                  />
                  <span>{item.type}</span>
                  <strong>{extractEstimateNumber(item.estimate)}</strong>
                  <small>镜/日</small>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <article className="section-card section-card-airy risk-row-card">
        <div className="section-head section-head-tight">
          <div>
            <span className="section-kicker">RISK RADAR</span>
            <h3>风险预警</h3>
          </div>
          <p>最严重风险单独放大，其余风险平铺到右侧列表。</p>
        </div>

        <div className="risk-row-layout">
          {criticalRisk ? (
            <article
              className="risk-signal-item risk-signal-item-critical"
              title={`${criticalRisk.description}｜${criticalRisk.response}`}
            >
              <div className="risk-signal-critical-icon">⚠️</div>
              <div className="risk-signal-critical-copy">
                <span className="section-kicker">
                  {criticalRisk.id} · {criticalRisk.category}
                </span>
                <strong>{criticalRisk.description}</strong>
                <p>{criticalRisk.response}</p>
              </div>
              <div className="risk-signal-critical-side">
                <StatusBadge value={criticalRisk.status} />
                <StatusBadge value={priorityFromImpact(criticalRisk.impact)} kind="priority" />
              </div>
            </article>
          ) : null}

          <div className="risk-signal-list risk-signal-list-compact">
            {minorRisks.map((risk) => (
              <article key={risk.id} className="risk-signal-item">
                <div className="risk-signal-top">
                  <div className="risk-signal-copy">
                    <strong>
                      {risk.id} · {risk.category}
                    </strong>
                    <p>{risk.description}</p>
                  </div>
                  <div className="risk-signal-badges">
                    <StatusBadge value={risk.status} />
                    <StatusBadge value={priorityFromImpact(risk.impact)} kind="priority" />
                  </div>
                </div>
                <div className="risk-signal-foot">
                  <span>{risk.response}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
