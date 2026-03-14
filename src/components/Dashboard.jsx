import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const STAGES = [
  { key: "script", label: "剧本", icon: "✎" },
  { key: "art", label: "美术", icon: "◐" },
  { key: "storyboard", label: "分镜", icon: "▦" },
  { key: "aiImage", label: "AI出图", icon: "◈" },
  { key: "video", label: "视频制作", icon: "▶" },
  { key: "edit", label: "剪辑", icon: "⊞" },
  { key: "post", label: "后期", icon: "◉" },
];

const STATUS_MAP = {
  done: { label: "已完成", color: "#2d9d78", bg: "rgba(45,157,120,0.12)" },
  active: { label: "进行中", color: "#e08a3c", bg: "rgba(224,138,60,0.12)" },
  review: { label: "审核中", color: "#7c6bc4", bg: "rgba(124,107,196,0.12)" },
  blocked: { label: "阻塞", color: "#d94f4f", bg: "rgba(217,79,79,0.12)" },
  pending: { label: "未开始", color: "#888", bg: "rgba(136,136,136,0.08)" },
};

const EPISODES = Array.from({ length: 8 }, (_, i) => {
  const ep = i + 1;
  const genStatus = (stageIdx) => {
    if (ep <= 2) return stageIdx <= 5 ? "done" : stageIdx === 6 ? "active" : "pending";
    if (ep === 3) return stageIdx <= 2 ? "done" : stageIdx === 3 ? "review" : stageIdx === 4 ? "active" : "pending";
    if (ep === 4) return stageIdx <= 1 ? "done" : stageIdx === 2 ? "active" : "pending";
    if (ep === 5) return stageIdx === 0 ? "done" : stageIdx === 1 ? "active" : "pending";
    if (ep === 6) return stageIdx === 0 ? "review" : "pending";
    if (ep === 7) return stageIdx === 0 ? "active" : "pending";
    return "pending";
  };
  return {
    ep,
    title: `第${ep}集`,
    stages: STAGES.map((s, idx) => ({ ...s, status: genStatus(idx) })),
    dueDate: `2026-${String(3 + Math.floor((ep - 1) / 2)).padStart(2, "0")}-${String(10 + ep * 3).padStart(2, "0")}`,
  };
});

const DAILY_LOG = [
  { date: "03-08", script: 2, art: 3, storyboard: 5, aiImage: 12, video: 1, edit: 1, post: 0 },
  { date: "03-09", script: 1, art: 2, storyboard: 4, aiImage: 18, video: 2, edit: 0, post: 0 },
  { date: "03-10", script: 3, art: 1, storyboard: 6, aiImage: 22, video: 1, edit: 2, post: 0 },
  { date: "03-11", script: 1, art: 4, storyboard: 3, aiImage: 15, video: 3, edit: 1, post: 1 },
  { date: "03-12", script: 2, art: 2, storyboard: 7, aiImage: 20, video: 2, edit: 2, post: 0 },
  { date: "03-13", script: 0, art: 3, storyboard: 4, aiImage: 25, video: 1, edit: 3, post: 1 },
  { date: "03-14", script: 1, art: 2, storyboard: 5, aiImage: 19, video: 2, edit: 1, post: 2 },
];

const ALERTS = [
  { level: "critical", msg: "第3集 AI出图审核已等待3天，请尽快处理", ep: 3, stage: "aiImage" },
  { level: "warning", msg: "第4集分镜进度落后计划2天", ep: 4, stage: "storyboard" },
  { level: "warning", msg: "第6集剧本审核意见未回复", ep: 6, stage: "script" },
  { level: "info", msg: "第1集后期明日截止，当前进度85%", ep: 1, stage: "post" },
  { level: "info", msg: "第5集美术资产已完成60%，进展顺利", ep: 5, stage: "art" },
];

const SUGGESTIONS = [
  { tag: "效率", text: "AI出图日均产出19张，建议将第4集分镜提前拆分批次，避免出图阶段堆积。" },
  { tag: "质量", text: "第3集审核滞留超72小时，建议今日优先安排审核会议，释放下游工序。" },
  { tag: "排期", text: "第5-6集剧本和美术可并行推进，当前美术线有1天空窗，建议提前启动第6集角色设定。" },
  { tag: "风险", text: "第7-8集剧本尚未启动，按当前速度需14天完成，距离交付仅剩18天，余量偏紧。" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--text-primary)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, lineHeight: 1.6 }}>{p.name}：{p.value}</div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [selectedEp, setSelectedEp] = useState(null);
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState("overview");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const overallStats = useMemo(() => {
    let done = 0, total = 0;
    EPISODES.forEach(ep => ep.stages.forEach(s => { total++; if (s.status === "done") done++; }));
    return { done, total, pct: Math.round((done / total) * 100) };
  }, []);

  const stageDistribution = useMemo(() => {
    return STAGES.map(stage => {
      let done = 0, active = 0, review = 0, blocked = 0, pending = 0;
      EPISODES.forEach(ep => {
        const s = ep.stages.find(st => st.key === stage.key);
        if (s.status === "done") done++;
        else if (s.status === "active") active++;
        else if (s.status === "review") review++;
        else if (s.status === "blocked") blocked++;
        else pending++;
      });
      return { name: stage.label, done, active, review, blocked, pending };
    });
  }, []);

  const todayData = DAILY_LOG[DAILY_LOG.length - 1];
  const todayTotal = Object.entries(todayData).filter(([k]) => k !== "date").reduce((a, [, v]) => a + v, 0);
  const criticalCount = ALERTS.filter(a => a.level === "critical").length;
  const warningCount = ALERTS.filter(a => a.level === "warning").length;

  return (
    <div style={{
      "--bg": "#0c0c0f", "--card-bg": "#151519", "--card-hover": "#1a1a20",
      "--border": "rgba(255,255,255,0.06)", "--border-hover": "rgba(255,255,255,0.12)",
      "--text-primary": "#e8e6e1", "--text-secondary": "rgba(232,230,225,0.55)",
      "--text-tertiary": "rgba(232,230,225,0.3)", "--accent": "#e08a3c", "--accent-dim": "rgba(224,138,60,0.15)",
      fontFamily: "'DM Sans', 'Noto Sans SC', system-ui, sans-serif",
      background: "var(--bg)", color: "var(--text-primary)", minHeight: "100vh",
      padding: "24px 20px", lineHeight: 1.5, fontSize: 13,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--text-tertiary)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Production control</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>AI漫剧制片工作台</h1>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{todayStr} · {timeStr} 更新</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["overview", "episodes", "alerts"].map(m => (
            <button key={m} onClick={() => { setViewMode(m); setSelectedEp(null); }} style={{
              background: viewMode === m ? "var(--accent-dim)" : "transparent",
              color: viewMode === m ? "var(--accent)" : "var(--text-secondary)",
              border: `1px solid ${viewMode === m ? "rgba(224,138,60,0.3)" : "var(--border)"}`,
              borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 500,
              transition: "all 0.2s",
            }}>
              {{ overview: "总览", episodes: "分集", alerts: "提醒" }[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Top Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "总进度", value: `${overallStats.pct}%`, sub: `${overallStats.done}/${overallStats.total} 完成`, color: "#2d9d78" },
          { label: "今日产出", value: todayTotal, sub: `AI出图 ${todayData.aiImage} 张`, color: "var(--accent)" },
          { label: "待处理审核", value: criticalCount + warningCount, sub: `${criticalCount} 紧急 · ${warningCount} 警告`, color: criticalCount > 0 ? "#d94f4f" : "var(--accent)" },
          { label: "本周完成集数", value: "2集", sub: "EP01 后期中 · EP02 剪辑中", color: "#7c6bc4" },
        ].map((card, i) => (
          <div key={i} style={{
            background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: card.color, opacity: 0.6 }} />
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.color, fontFamily: "'DM Mono', monospace", letterSpacing: -1 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {viewMode === "overview" && (
        <>
          {/* Pipeline Heatmap */}
          <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>管线全局状态</span>
              <div style={{ display: "flex", gap: 12 }}>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 10, color: v.color, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: v.color, display: "inline-block" }} />
                    {v.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 1fr)", gap: "3px 4px", alignItems: "center" }}>
              <div />
              {STAGES.map(s => (
                <div key={s.key} style={{ fontSize: 10, color: "var(--text-tertiary)", textAlign: "center", fontWeight: 500, padding: "0 0 6px" }}>{s.icon} {s.label}</div>
              ))}
              {EPISODES.map(ep => (
                <React.Fragment key={ep.ep}>
                  <div
                    onClick={() => { setSelectedEp(selectedEp === ep.ep ? null : ep.ep); setViewMode("episodes"); }}
                    style={{ fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", fontFamily: "'DM Mono', monospace", padding: "4px 0" }}
                  >
                    EP{String(ep.ep).padStart(2, "0")}
                  </div>
                  {ep.stages.map((s, idx) => {
                    const st = STATUS_MAP[s.status];
                    return (
                      <div key={idx} style={{
                        background: st.bg, borderRadius: 4, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: st.color, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                        border: `1px solid ${s.status === "blocked" ? "rgba(217,79,79,0.3)" : "transparent"}`,
                      }}
                        title={`${ep.title} ${s.label}: ${st.label}`}
                        onClick={() => { setSelectedEp(ep.ep); setViewMode("episodes"); }}
                      >
                        {s.status === "done" ? "✓" : s.status === "active" ? "◦" : s.status === "review" ? "⊙" : s.status === "blocked" ? "!" : "–"}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>7日产出趋势</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={DAILY_LOG}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(232,230,225,0.35)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(232,230,225,0.35)" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="aiImage" stroke="#e08a3c" strokeWidth={2} dot={false} name="AI出图" />
                  <Line type="monotone" dataKey="storyboard" stroke="#7c6bc4" strokeWidth={1.5} dot={false} name="分镜" />
                  <Line type="monotone" dataKey="video" stroke="#2d9d78" strokeWidth={1.5} dot={false} name="视频" />
                  <Line type="monotone" dataKey="edit" stroke="#5b9bd5" strokeWidth={1.5} dot={false} name="剪辑" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>各工序完成率</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stageDistribution} layout="vertical" barSize={14}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(232,230,225,0.35)" }} axisLine={false} tickLine={false} domain={[0, 8]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "rgba(232,230,225,0.55)" }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="done" stackId="a" fill="#2d9d78" name="已完成" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="active" stackId="a" fill="#e08a3c" name="进行中" />
                  <Bar dataKey="review" stackId="a" fill="#7c6bc4" name="审核中" />
                  <Bar dataKey="pending" stackId="a" fill="rgba(136,136,136,0.2)" name="未开始" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Suggestions + Alerts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                今日建议
              </div>
              {SUGGESTIONS.map((s, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: i < SUGGESTIONS.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, marginRight: 8,
                    background: s.tag === "效率" ? "rgba(45,157,120,0.12)" : s.tag === "质量" ? "rgba(124,107,196,0.12)" : s.tag === "排期" ? "rgba(224,138,60,0.12)" : "rgba(217,79,79,0.12)",
                    color: s.tag === "效率" ? "#2d9d78" : s.tag === "质量" ? "#7c6bc4" : s.tag === "排期" ? "#e08a3c" : "#d94f4f",
                  }}>{s.tag}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{s.text}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d94f4f" }} />
                提醒事项
              </div>
              {ALERTS.map((a, i) => (
                <div key={i} style={{
                  padding: "10px 12px", marginBottom: 6, borderRadius: 6, fontSize: 12,
                  background: a.level === "critical" ? "rgba(217,79,79,0.08)" : a.level === "warning" ? "rgba(224,138,60,0.06)" : "rgba(136,136,136,0.04)",
                  borderLeft: `3px solid ${a.level === "critical" ? "#d94f4f" : a.level === "warning" ? "#e08a3c" : "rgba(136,136,136,0.3)"}`,
                  color: "var(--text-secondary)",
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600, textTransform: "uppercase", marginRight: 6,
                    color: a.level === "critical" ? "#d94f4f" : a.level === "warning" ? "#e08a3c" : "var(--text-tertiary)",
                  }}>
                    {a.level === "critical" ? "紧急" : a.level === "warning" ? "警告" : "通知"}
                  </span>
                  {a.msg}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {viewMode === "episodes" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {EPISODES.map(ep => {
              const doneCt = ep.stages.filter(s => s.status === "done").length;
              const isSelected = selectedEp === ep.ep;
              const currentStage = ep.stages.find(s => s.status === "active" || s.status === "review") || ep.stages[ep.stages.length - 1];
              return (
                <div key={ep.ep} onClick={() => setSelectedEp(isSelected ? null : ep.ep)} style={{
                  background: isSelected ? "var(--card-hover)" : "var(--card-bg)",
                  border: `1px solid ${isSelected ? "rgba(224,138,60,0.4)" : "var(--border)"}`,
                  borderRadius: 10, padding: 14, cursor: "pointer", transition: "all 0.2s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600 }}>EP{String(ep.ep).padStart(2, "0")}</span>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{doneCt}/7</span>
                  </div>
                  {/* Mini progress bar */}
                  <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
                    {ep.stages.map((s, idx) => (
                      <div key={idx} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: STATUS_MAP[s.status].color,
                        opacity: s.status === "pending" ? 0.15 : 0.7,
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    当前：<span style={{ color: STATUS_MAP[currentStage.status].color, fontWeight: 500 }}>{currentStage.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>截止 {ep.dueDate}</div>
                </div>
              );
            })}
          </div>
          {selectedEp && (() => {
            const ep = EPISODES.find(e => e.ep === selectedEp);
            const epAlerts = ALERTS.filter(a => a.ep === selectedEp);
            return (
              <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
                  EP{String(ep.ep).padStart(2, "0")} · 详细状态
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 16 }}>
                  {ep.stages.map((s, idx) => {
                    const st = STATUS_MAP[s.status];
                    return (
                      <div key={idx} style={{
                        background: st.bg, borderRadius: 8, padding: "12px 8px", textAlign: "center",
                        border: `1px solid ${s.status === "active" ? "rgba(224,138,60,0.25)" : "transparent"}`,
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 6 }}>{s.icon}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: st.color, marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{st.label}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Timeline connector */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "0 auto 16px", maxWidth: "90%", padding: "0 20px" }}>
                  {ep.stages.map((s, idx) => (
                    <React.Fragment key={idx}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%", background: STATUS_MAP[s.status].color,
                        flexShrink: 0, border: s.status === "active" ? "2px solid var(--accent)" : "none", boxSizing: "border-box",
                      }} />
                      {idx < ep.stages.length - 1 && (
                        <div style={{
                          flex: 1, height: 2,
                          background: ep.stages[idx + 1].status !== "pending" ? STATUS_MAP[ep.stages[idx + 1].status].color : "var(--border)",
                          opacity: ep.stages[idx + 1].status === "pending" ? 0.3 : 0.5,
                        }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                {epAlerts.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 8 }}>本集提醒</div>
                    {epAlerts.map((a, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: "var(--text-secondary)", padding: "6px 10px", marginBottom: 4, borderRadius: 4,
                        borderLeft: `3px solid ${a.level === "critical" ? "#d94f4f" : a.level === "warning" ? "#e08a3c" : "#888"}`,
                        background: a.level === "critical" ? "rgba(217,79,79,0.06)" : "transparent",
                      }}>{a.msg}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {viewMode === "alerts" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>提醒与预警</div>
              {["critical", "warning", "info"].map(level => (
                <div key={level} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
                    color: level === "critical" ? "#d94f4f" : level === "warning" ? "#e08a3c" : "var(--text-tertiary)",
                  }}>
                    {level === "critical" ? "紧急" : level === "warning" ? "警告" : "通知"} · {ALERTS.filter(a => a.level === level).length}
                  </div>
                  {ALERTS.filter(a => a.level === level).map((a, i) => (
                    <div key={i} style={{
                      background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8,
                      padding: "12px 14px", marginBottom: 6,
                      borderLeft: `3px solid ${level === "critical" ? "#d94f4f" : level === "warning" ? "#e08a3c" : "rgba(136,136,136,0.3)"}`,
                    }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{a.msg}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        EP{String(a.ep).padStart(2, "0")} · {STAGES.find(s => s.key === a.stage)?.label}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>智能建议</div>
              {SUGGESTIONS.map((s, i) => (
                <div key={i} style={{
                  background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "14px 16px", marginBottom: 8,
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 10px", borderRadius: 10,
                      background: s.tag === "效率" ? "rgba(45,157,120,0.12)" : s.tag === "质量" ? "rgba(124,107,196,0.12)" : s.tag === "排期" ? "rgba(224,138,60,0.12)" : "rgba(217,79,79,0.12)",
                      color: s.tag === "效率" ? "#2d9d78" : s.tag === "质量" ? "#7c6bc4" : s.tag === "排期" ? "#e08a3c" : "#d94f4f",
                    }}>{s.tag}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>{s.text}</div>
                </div>
              ))}
              <div style={{
                background: "rgba(224,138,60,0.06)", border: "1px dashed rgba(224,138,60,0.2)", borderRadius: 8,
                padding: "12px 14px", marginTop: 12, fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.7,
              }}>
                建议基于7日数据自动生成，每日刷新。接入飞书多维表格后可获取实时数据驱动的精准建议。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, padding: "12px 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>AI漫剧制片管理系统 v0.1</span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>数据来源：飞书多维表格 · 每日自动同步</span>
      </div>
    </div>
  );
}
