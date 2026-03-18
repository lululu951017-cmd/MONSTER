import React from "react";
import { buildEpisodeColorMap, buildPipelineRange, monthColumns } from "../dashboardModel.js";
import { ProgressBar, StatusBadge } from "./ui.jsx";

export default function PlanView({ project, pipeline, episodeSchedule, episodes }) {
  const episodeColors = buildEpisodeColorMap({ episodes });
  const months = monthColumns();

  return (
    <section className="project-view-stack">
      <section className="card section-card">
        <div className="section-head">
          <div>
            <span className="section-kicker">制作管线</span>
            <h2>21 个阶段甘特图</h2>
          </div>
          <p>
            从 {project.startDate} 到 {project.endDate}，覆盖剧本开发、资产搭建、分镜制作、视频制作、后期、
            广电送审与正片提交。
          </p>
        </div>

        <div className="gantt-shell">
          <div className="gantt-header">
            <div className="gantt-meta-head">阶段 / 负责人</div>
            <div className="gantt-timeline-head">
              {months.map((month) => (
                <span key={month}>{month}</span>
              ))}
            </div>
          </div>

          <div className="gantt-rows">
            {pipeline.map((stage) => {
              const range = buildPipelineRange(stage, project);
              return (
                <div key={stage.id} className="gantt-row">
                  <div className="gantt-meta">
                    <strong>{stage.stage}</strong>
                    <span>{stage.owner}</span>
                    <small>
                      {stage.startDate} → {stage.endDate}
                    </small>
                  </div>
                  <div className="gantt-track">
                    <div className="gantt-track-grid">
                      {months.map((month) => (
                        <span key={`${stage.id}-${month}`} />
                      ))}
                    </div>
                    <div className="gantt-bar" style={range}>
                      <span>{stage.progress}%</span>
                    </div>
                  </div>
                  <div className="gantt-side">
                    <StatusBadge value={stage.status} />
                    <small>{stage.note || stage.dependency || "按主线推进"}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <span className="section-kicker">分集排期</span>
            <h2>6 集详细时间线</h2>
          </div>
          <p>按集数色彩区分，每集从剧本、文字分镜、AI 分镜制作到后期串联展示。</p>
        </div>

        <div className="episode-schedule-grid">
          {episodes.map((episode) => {
            const rows = episodeSchedule.filter((row) => row.episode === episode.episode);
            return (
              <article key={episode.episode} className="episode-schedule-card">
                <div className="episode-schedule-head">
                  <span className="episode-color" style={{ background: episode.color }} />
                  <div>
                    <strong>{episode.episode}</strong>
                    <p>{episode.stage}</p>
                  </div>
                  <StatusBadge value={episode.status} />
                </div>

                <ProgressBar value={episode.progress} />

                <div className="compact-table">
                  <div className="table-head schedule-table">
                    <span>阶段</span>
                    <span>负责人</span>
                    <span>排期</span>
                    <span>状态</span>
                  </div>
                  <div className="table-body">
                    {rows.map((row) => (
                      <div key={`${episode.episode}-${row.stage}`} className="table-row schedule-table">
                        <span>{row.stage}</span>
                        <span>{row.owner}</span>
                        <span>
                          {row.startDate} → {row.endDate}
                        </span>
                        <span>
                          <StatusBadge value={row.status} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
