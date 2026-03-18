import React from "react";
import { ProgressBar } from "./ui.jsx";

export default function ReportView({
  teamMembers,
  workspaceState,
  entryForm,
  onEntryFormChange,
  onSaveLog,
  report,
  summaryStats,
}) {
  return (
    <>
      <section className="ops-section">
        <div className="section-head outer">
          <div>
            <span className="panel-label">录入区</span>
            <h2>手动录入今日推进</h2>
          </div>
          <p>日报和录入都留在这一页；点击保存或 Ctrl+Enter 提交后会立即写入持久化存储。</p>
        </div>

        <div className="ops-grid">
          <form className="card entry-card" onSubmit={onSaveLog}>
            <div className="entry-grid">
              <label>
                <span>日期</span>
                <input type="date" value={entryForm.date} onChange={(event) => onEntryFormChange("date", event.target.value)} />
              </label>
              <label>
                <span>成员</span>
                <select value={entryForm.member} onChange={(event) => onEntryFormChange("member", event.target.value)}>
                  {teamMembers.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>新增成员</span>
                <input
                  type="text"
                  placeholder="如需新增成员可直接输入名字"
                  value={entryForm.newMember}
                  onChange={(event) => onEntryFormChange("newMember", event.target.value)}
                />
              </label>
              <label>
                <span>今日完成镜数</span>
                <input
                  type="number"
                  min="0"
                  placeholder="例如 5"
                  value={entryForm.shotsCount}
                  onChange={(event) => onEntryFormChange("shotsCount", event.target.value)}
                />
              </label>
              <label className="entry-span-3">
                <span>今天做了什么（支持 Markdown / Ctrl+Enter 保存）</span>
                <textarea
                  placeholder="例如：第九场 112-116 镜完成确定画面，导演已过第一轮。"
                  value={entryForm.content}
                  onChange={(event) => onEntryFormChange("content", event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
              </label>
            </div>

            <div className="hero-actions">
              <button type="submit" className="button button-dark">
                点击保存
              </button>
            </div>
          </form>

          <article className="card log-card">
            <div className="section-head">
              <div>
                <span className="panel-label">最近日志</span>
                <h2>手动录入记录</h2>
              </div>
            </div>
            <div className="structured-list">
              {workspaceState.dailyLogs.length ? (
                workspaceState.dailyLogs.slice(0, 8).map((log) => (
                  <article key={log.id} className="structured-item">
                    <span className="structured-icon">✎</span>
                    <div className="structured-copy">
                      <strong>
                        {log.date} · {log.member}
                      </strong>
                      <p>{log.content}</p>
                    </div>
                    <span className="assignment-meta">{log.shotsCount ? `产出 ${log.shotsCount} 镜` : "未填镜数"}</span>
                  </article>
                ))
              ) : (
                <article className="structured-item">
                  <span className="structured-icon">✎</span>
                  <div className="structured-copy">
                    <strong>还没有录入日志</strong>
                    <p>第一条可以直接从今天的推进开始。</p>
                  </div>
                </article>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="report-section">
        <div className="section-head outer">
          <div>
            <span className="panel-label">制片日报</span>
            <h2>{report.title}</h2>
          </div>
          <p>这里的日报内容会随着当前状态和新录入的日志自动刷新。</p>
        </div>

        <section className="report-summary-section">
          <h3>今日总览</h3>
          <div className="report-summary-grid">
            {summaryStats.map((item) => (
              <div key={item.label} className="report-summary-item">
                <span className="report-summary-label">{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.meta}</small>
              </div>
            ))}
          </div>
        </section>

        <article className="card report-card">
          <div className="report-block">
            <h3>各线路状态</h3>
            <div className="report-track-grid">
              {report.trackStatus.map((item) => (
                <div key={item.title} className="report-track">
                  <strong>
                    {item.title} <span>{item.progress}</span>
                  </strong>
                  <ProgressBar value={Number(String(item.progress).replace("%", ""))} />
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="report-block report-risk-block">
            <h3>风险与阻塞</h3>
            <div className="structured-list">
              {report.risks.map((line) => (
                <article key={line} className="structured-item tone-danger">
                  <span className="structured-icon">⚠</span>
                  <div className="structured-copy">
                    <strong>{line}</strong>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <details className="report-fold">
            <summary>备注与建议（点击展开）</summary>
            <div className="report-fold-body">
              <div className="report-block">
                <h3>明日计划</h3>
                <ul className="report-plain-list">
                  {report.tomorrow.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <div className="report-block">
                <h3>备注</h3>
                <ul className="report-plain-list">
                  <li>{report.note}</li>
                </ul>
              </div>
            </div>
          </details>
        </article>
      </section>
    </>
  );
}
