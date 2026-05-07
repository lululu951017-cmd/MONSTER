import React, { useMemo, useState } from "react";
import { DataPair, ProgressBar, StatusBadge } from "./ui.jsx";

function getAiStatusMeta(member) {
  if ((member?.revision ?? 0) > 0) {
    return { label: "返修中", tone: "danger", dot: "danger" };
  }
  if ((member?.pending ?? 0) > 0 || (member?.done ?? 0) > 0) {
    return { label: "进行中", tone: "warning", dot: "good" };
  }
  return { label: "未启动", tone: "neutral", dot: "neutral" };
}

function getProgressTone(member) {
  if ((member?.revision ?? 0) > 0) return "danger";
  if ((member?.pending ?? 0) > (member?.done ?? 0)) return "warning";
  return "good";
}

function buildCoreCollab(member) {
  const map = {
    项目制片人: "编剧、分镜导演、AI 导演、美术、技术与后期",
    编剧: "项目制片人、世界观设定、分镜导演",
    世界观设定: "编剧、美术总监、技术负责人",
    AI导演: "项目制片人、分镜导演、美术总监",
    分镜导演: "编剧、AI 导演、AI 制作团队",
    美术总监: "世界观设定、技术负责人、资产设计组",
    技术负责人: "AI 导演、美术总监、模型资产、LORA 风格",
    后期及声音统筹: "项目制片人、技术负责人、成片制作",
  };

  return map[member?.role] ?? member?.responsibility ?? "待补充";
}

function buildWeeklyTargetLabel(member) {
  if (member?.weeklyGoal) return member.weeklyGoal;
  return "本周目标待补充";
}

function buildCoverageCount(member) {
  return Array.isArray(member?.sceneCoverage) ? member.sceneCoverage.length : 0;
}

export default function TeamView({ coreTeam = [], aiTeam = [], selectedMember, onSelectMember }) {
  const [selectedCoreName, setSelectedCoreName] = useState(coreTeam?.[0]?.name ?? "");

  const selectedCore = useMemo(
    () => coreTeam.find((member) => member.name === selectedCoreName) ?? coreTeam[0] ?? null,
    [coreTeam, selectedCoreName],
  );

  const selectedAiMember = selectedMember ?? aiTeam[0] ?? null;
  const selectedAiStatus = getAiStatusMeta(selectedAiMember);
  const progressTone = getProgressTone(selectedAiMember);
  const weeklyGoalText = buildWeeklyTargetLabel(selectedAiMember);
  const sceneCoverageCount = buildCoverageCount(selectedAiMember);
  const compareDailyPercent = selectedAiMember
    ? Math.min(100, Math.round(((selectedAiMember.done ?? 0) / Math.max(1, selectedAiMember.dailyTarget ?? 1)) * 100))
    : 0;
  const compareWeeklyPercent = selectedAiMember
    ? Math.min(
        100,
        Math.round(((selectedAiMember.done + selectedAiMember.revision) / Math.max(1, selectedAiMember.assignedShots ?? 1)) * 100),
      )
    : 0;

  return (
    <section className="project-view-stack team-shell">
      {coreTeam.length ? (
        <section className="section-card section-card-airy team-core-section">
          <div className="section-head team-section-head">
            <div>
              <span className="section-kicker">TEAM LEAD</span>
              <h2>核心管理团队 {coreTeam.length} 人</h2>
            </div>
            <p>保留制片、编剧、AI 导演、美术、技术和后期统筹的当前任务，用来支撑全局把控。</p>
          </div>

          <div className="team-core-grid">
            {coreTeam.map((member) => (
              <button
                key={member.name}
                type="button"
                className={`team-core-card ${selectedCore?.name === member.name ? "is-selected" : ""}`}
                onClick={() => setSelectedCoreName(member.name)}
              >
                <div className="team-core-card-head">
                  <div>
                    <strong>{member.name}</strong>
                    <span>{member.role}</span>
                  </div>
                  <StatusBadge value={member.status || "进行中"} />
                </div>

                <p>{member.responsibility}</p>

                <div className="team-core-card-foot">
                  <StatusBadge value={member.priority || "P1"} kind="priority" />
                  <span>{member.currentTask}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedCore ? (
            <div className="team-core-detail-plain">
              <div className="team-plain-block">
                <span>当前主攻节点</span>
                <strong>{selectedCore.currentTask}</strong>
              </div>
              <div className="team-plain-block">
                <span>关键协同</span>
                <strong>{buildCoreCollab(selectedCore)}</strong>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="section-card section-card-airy team-ai-section">
        <div className="section-head team-section-head">
          <div>
            <span className="section-kicker">EXECUTION DESK</span>
            <h2>AI 制作团队</h2>
          </div>
          <p>左侧选择成员，右侧查看执行看板、目标差距和当日预警，保持一眼能看懂的管理视角。</p>
        </div>

        <div className="team-workspace-grid">
          <aside className="team-member-sidebar">
            {aiTeam.map((member) => {
              const statusMeta = getAiStatusMeta(member);

              return (
                <button
                  key={member.name}
                  type="button"
                  className={`team-member-card ${selectedAiMember?.name === member.name ? "is-selected" : ""}`}
                  onClick={() => onSelectMember(member.name)}
                >
                  <span className={`team-member-status-dot tone-${statusMeta.dot}`} />
                  <span className="team-member-avatar">{member.name?.slice(0, 1) || "人"}</span>
                  <div className="team-member-copy">
                    <strong>{member.name}</strong>
                    <small>{member.group}</small>
                  </div>
                </button>
              );
            })}
          </aside>

          {selectedAiMember ? (
            <article className="team-member-panel">
              <div className="team-member-panel-head">
                <div>
                  <span className="section-kicker">MEMBER DETAIL</span>
                  <h3>{selectedAiMember.name} 的执行详情</h3>
                </div>
                <StatusBadge value={selectedAiStatus.label} />
              </div>

              <div className="team-kpi-grid">
                <div className="team-kpi-primary">
                  <span>剩余工作量</span>
                  <strong>{selectedAiMember.remainingWorkload} 镜</strong>
                  <small>当前仍需推进的镜头数量</small>
                </div>

                <div className="team-kpi-primary">
                  <span>进度百分比</span>
                  <strong>{selectedAiMember.progress}%</strong>
                  <small>已确认 + 返修 / 总负责镜头</small>
                </div>
              </div>

              <div className="team-kpi-secondary-grid">
                <DataPair label="已确认" value={`${selectedAiMember.done}`} meta="当前已完成镜头" />
                <DataPair label="返修中" value={`${selectedAiMember.revision}`} meta="需要优先收口" />
                <DataPair label="待制作" value={`${selectedAiMember.pending}`} meta="尚未开工镜头" />
                <DataPair label="日目标" value={`${selectedAiMember.dailyTarget} 镜`} meta={`预计 ${selectedAiMember.estimatedDays} 天`} />
              </div>

              <div className="team-detail-module-grid">
                <section className="team-detail-module">
                  <div className="team-detail-module-head">
                    <strong>目标对比</strong>
                    <span>{weeklyGoalText}</span>
                  </div>

                  <div className="team-compare-stack">
                    <div className="team-compare-row">
                      <div className="team-compare-copy">
                        <strong>当前进度</strong>
                        <small>{selectedAiMember.done + selectedAiMember.revision}/{selectedAiMember.assignedShots} 镜</small>
                      </div>
                      <ProgressBar value={selectedAiMember.progress} tone={progressTone} />
                    </div>

                    <div className="team-compare-row">
                      <div className="team-compare-copy">
                        <strong>日目标达成</strong>
                        <small>{selectedAiMember.done}/{selectedAiMember.dailyTarget} 镜</small>
                      </div>
                      <ProgressBar value={compareDailyPercent} tone={selectedAiMember.done >= selectedAiMember.dailyTarget ? "good" : "warning"} />
                    </div>

                    <div className="team-compare-metrics">
                      <div className="team-compare-metric">
                        <span>负责镜头</span>
                        <strong>{selectedAiMember.assignedShots}</strong>
                      </div>
                      <div className="team-compare-metric">
                        <span>涉及场次</span>
                        <strong>{sceneCoverageCount}</strong>
                      </div>
                      <div className="team-compare-metric">
                        <span>本周推进</span>
                        <strong>{compareWeeklyPercent}%</strong>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="team-detail-module team-detail-module-alerts">
                  <div className="team-detail-module-head">
                    <strong>预警区</strong>
                    <span>把最需要盯的点单独拉出来</span>
                  </div>

                  <div className="team-alert-grid">
                    <article className="team-alert-card tone-soft-danger">
                      <span>今日重点</span>
                      <strong>{selectedAiMember.todayP0 || selectedAiMember.todayP1 || "今日暂无重点"}</strong>
                      <small>{selectedAiMember.priorityNote || "任务备注待同步"}</small>
                    </article>

                    <article className="team-alert-card tone-soft-warning">
                      <span>当前风险</span>
                      <strong>⚠ {selectedAiMember.riskNote || "暂无明显风险"}</strong>
                      <small>{selectedAiMember.remark || "当前无额外备注"}</small>
                    </article>
                  </div>
                </section>
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </section>
  );
}
