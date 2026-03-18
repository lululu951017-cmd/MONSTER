import React, { useMemo, useState } from "react";

function getPriorityTone(priority) {
  if (priority === "P0") return "is-p0";
  if (priority === "P1") return "is-p1";
  return "is-p2";
}

function getAiStatus(member) {
  if (member.revision > 0) return "返修中";
  if (member.pending > 0 || member.done > 0) return "进行中";
  return "未启动";
}

function buildCoreCollab(member) {
  const map = {
    "项目制片人": "编剧 / AI导演 / 分镜导演 / 美术总监 / 技术负责人",
    编剧: "项目制片人 / 世界观设定 / 分镜导演",
    世界观设定: "编剧 / 美术总监 / 技术负责人",
    AI导演: "项目制片人 / 分镜导演 / 美术总监",
    分镜导演: "编剧 / AI导演 / AI 制作团队",
    美术总监: "世界观设定 / 技术负责人 / AI 制作团队",
    技术负责人: "AI导演 / 美术总监 / 模型资产 / LORA风格",
    "后期及声音统筹": "项目制片人 / 技术负责人 / 成片制作",
  };

  return map[member.role] ?? member.responsibility ?? "待补充";
}

function buildTodayFocus(member) {
  if (member.todayP0) return member.todayP0;
  if (member.todayP1) return member.todayP1;
  if (member.revision > 0) return `优先处理 ${member.revision} 镜返修`;
  if (member.pending > 0) return `优先推进 ${Math.min(member.dailyTarget, member.pending)} 镜待制作`;
  return "维持当前完成节奏";
}

function buildWeeklyTarget(member) {
  return `${Math.min(member.remainingWorkload, member.dailyTarget * 5)} 镜`;
}

export default function TeamView({ coreTeam, aiTeam, selectedMember, onSelectMember }) {
  const [selectedCoreName, setSelectedCoreName] = useState(coreTeam[0]?.name ?? "");

  const selectedCore = useMemo(
    () => coreTeam.find((member) => member.name === selectedCoreName) ?? coreTeam[0],
    [coreTeam, selectedCoreName],
  );

  return (
    <section className="project-view-stack team-reference-page">
      <section className="section-card section-card-airy team-reference-section">
        <div className="section-head team-reference-head">
          <div>
            <span className="section-kicker">团队分工</span>
            <h2>核心管理团队 8 人</h2>
          </div>
          <p>保留制片、编剧、AI 导演、美术、技术和后期统筹的当前任务，用来支撑 6 集项目总控。</p>
        </div>

        <div className="team-reference-grid team-reference-grid-core">
          {coreTeam.map((member) => (
            <button
              key={member.name}
              type="button"
              className={`team-reference-card ${selectedCore?.name === member.name ? "is-selected" : ""}`}
              onClick={() => setSelectedCoreName(member.name)}
            >
              <div className="team-reference-card-top">
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.role}</span>
                </div>
                <span className="team-card-status">{member.status}</span>
              </div>

              <p className="team-reference-copy">{member.responsibility}</p>

              <div className="team-reference-card-bottom">
                <span className={`team-card-priority ${getPriorityTone(member.priority)}`}>{member.priority}</span>
                <span className="team-card-task">{member.currentTask}</span>
              </div>
            </button>
          ))}
        </div>

        {selectedCore ? (
          <section className="team-detail-panel">
            <div className="team-detail-panel-head">
              <span className="section-kicker">CORE DETAIL</span>
              <strong>{selectedCore.name}</strong>
            </div>

            <div className="team-detail-panel-grid team-detail-panel-grid-core">
              <article className="team-detail-block">
                <span>当前主攻节点</span>
                <strong>{selectedCore.currentTask}</strong>
              </article>
              <article className="team-detail-block">
                <span>关键协同</span>
                <p>{buildCoreCollab(selectedCore)}</p>
              </article>
            </div>
          </section>
        ) : null}
      </section>

      <section className="section-card section-card-airy team-reference-section">
        <div className="section-head team-reference-head">
          <div>
            <span className="section-kicker">镜头重新分配方案</span>
            <h2>10 人制作组每日任务量</h2>
          </div>
          <p>这里已经切成多人分配：文戏组、动作组、氛围组、修整组，包含负责镜头、每日目标和今日优先级。</p>
        </div>

        <div className="team-reference-grid team-reference-grid-ai">
          {aiTeam.map((member) => (
            <button
              key={member.name}
              type="button"
              className={`team-reference-card ${selectedMember?.name === member.name ? "is-selected" : ""}`}
              onClick={() => onSelectMember(member.name)}
            >
              <div className="team-reference-card-top">
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.group}</span>
                </div>
                <span className={`team-card-priority ${getPriorityTone(member.todayPriority)}`}>{member.todayPriority}</span>
              </div>

              <div className="team-ai-summary">
                <span>负责 {member.assignedShots} 镜</span>
                <span>已确认 {member.done}</span>
                <span>修改中 {member.revision}</span>
                <span>待制作 {member.pending}</span>
              </div>
            </button>
          ))}
        </div>

        {selectedMember ? (
          <section className="team-detail-panel">
            <div className="team-detail-panel-head">
              <span className="section-kicker">MEMBER DETAIL</span>
              <strong>{selectedMember.name} 的执行详情</strong>
            </div>

            <div className="team-detail-panel-grid team-detail-panel-grid-ai">
              <article className="team-detail-kpi">
                <span>负责镜头</span>
                <strong>{selectedMember.assignedShots}</strong>
                <small>镜</small>
              </article>
              <article className="team-detail-kpi team-detail-kpi-wide">
                <span>已确认 / 修改中 / 待制作</span>
                <strong>
                  {selectedMember.done}/{selectedMember.revision}/{selectedMember.pending}
                </strong>
                <small>核心推进面</small>
              </article>
              <article className="team-detail-kpi">
                <span>剩余工作量</span>
                <strong>{selectedMember.remainingWorkload}</strong>
                <small>镜</small>
              </article>
              <article className="team-detail-kpi">
                <span>每日目标</span>
                <strong>{selectedMember.dailyTarget}</strong>
                <small>镜 / 日</small>
              </article>
            </div>

            <div className="team-detail-alert">⚠️ {selectedMember.riskNote || "当前无新增风险"}</div>

            <div className="team-detail-panel-grid team-detail-panel-grid-triple">
              <article className="team-detail-block">
                <span>今日重点</span>
                <strong>{buildTodayFocus(selectedMember)}</strong>
              </article>
              <article className="team-detail-block">
                <span>本周推进</span>
                <strong>{buildWeeklyTarget(selectedMember)}</strong>
              </article>
              <article className="team-detail-block">
                <span>当前状态</span>
                <strong>{getAiStatus(selectedMember)}</strong>
              </article>
            </div>
          </section>
        ) : null}
      </section>
    </section>
  );
}
