import React, { useEffect, useMemo, useState } from "react";
import "../dashboard.css";
import { buildAssetSummary, buildProjectStats, buildRiskSummary, getMemberByName, groupPriorities } from "./dashboardModel.js";
import { BottomNavTab, OrbiterMark, ViewTab } from "./dashboard/ui.jsx";
import OverviewView from "./dashboard/OverviewView.jsx";
import TeamView from "./dashboard/TeamView.jsx";
import PlanView from "./dashboard/PlanView.jsx";
import StoryboardView from "./dashboard/StoryboardView.jsx";

const DEFAULT_VIEW_TABS = [
  { key: "overview", label: "总览", shortLabel: "总" },
  { key: "team", label: "团队", shortLabel: "队" },
  { key: "plan", label: "管线", shortLabel: "线" },
  { key: "storyboard", label: "分镜", shortLabel: "镜" },
];

const FEISHU_ONLY_TABS = [
  { key: "overview", label: "总览", shortLabel: "总" },
  { key: "team", label: "团队", shortLabel: "队" },
  { key: "storyboard", label: "分镜", shortLabel: "镜" },
];

const VIEW_META = {
  overview: { title: "项目总览" },
  team: { title: "团队执行" },
  plan: { title: "制作管线" },
  storyboard: { title: "第一集分镜" },
};

function RuntimeEmptyState() {
  return (
    <div className="monster-dashboard">
      <div className="dashboard-shell">
        <main className="dashboard-board">
          <header className="hero-card hero-card-minimal">
            <div className="hero-copy">
              <span className="hero-kicker">MONSTER PRODUCTION HUB</span>
              <h1>怪物制片台</h1>
            </div>
            <div className="hero-meta-strip">
              <span className="hero-meta-chip">
                <OrbiterMark tone="accent" small />
                等待飞书同步
              </span>
            </div>
          </header>

          <section className="card section-card section-card-airy">
            <div className="section-head">
              <div>
                <span className="section-kicker">RUNTIME REQUIRED</span>
                <h2>当前页面只呈现飞书内容</h2>
              </div>
              <p>请先运行飞书同步命令，生成最新 runtime 文件后再刷新网页。</p>
            </div>
            <pre className="code-block-lite">npm run sync:feishu:monster</pre>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [activeView, setActiveView] = useState("overview");
  const [selectedMemberName, setSelectedMemberName] = useState("");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState("all");
  const [selectedEpisodeFilter, setSelectedEpisodeFilter] = useState("第一集");
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [storyboardFilter, setStoryboardFilter] = useState("all");

  useEffect(() => {
    let alive = true;

    async function loadRuntimeDashboard() {
      try {
        const response = await fetch("/monsterProjectDashboard.runtime.json", { cache: "no-store" });
        if (!response.ok) throw new Error("runtime json not found");

        const runtimeData = await response.json();
        if (!runtimeData?.project || !runtimeData?.storyboard?.scenes) {
          throw new Error("runtime json invalid");
        }

        if (alive) {
          setDashboardData(runtimeData);
          setSelectedMemberName(runtimeData.aiTeam?.[0]?.name ?? "");
          setSelectedEpisodeFilter(runtimeData.project?.episodeLabel ?? "第一集");
          setSelectedSceneId(runtimeData.storyboard?.scenes?.[0]?.sceneId ?? "");
          setRuntimeReady(true);
        }
      } catch {
        if (alive) {
          setRuntimeReady(false);
        }
      }
    }

    loadRuntimeDashboard();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!dashboardData) return;

    if (!dashboardData.aiTeam?.some((member) => member.name === selectedMemberName)) {
      setSelectedMemberName(dashboardData.aiTeam?.[0]?.name ?? "");
    }

    if (
      selectedMemberFilter !== "all" &&
      !dashboardData.aiTeam?.some((member) => member.name === selectedMemberFilter)
    ) {
      setSelectedMemberFilter("all");
    }

    if (!selectedEpisodeFilter) {
      setSelectedEpisodeFilter(dashboardData.project?.episodeLabel ?? "第一集");
    }

    if (!dashboardData.storyboard?.scenes?.some((scene) => scene.sceneId === selectedSceneId)) {
      setSelectedSceneId(dashboardData.storyboard?.scenes?.[0]?.sceneId ?? "");
    }
  }, [dashboardData, selectedEpisodeFilter, selectedMemberFilter, selectedMemberName, selectedSceneId]);

  const safeData = dashboardData ?? {
    project: {},
    coreTeam: [],
    aiTeam: [],
    risks: [],
    pipeline: [],
    episodeSchedule: [],
    episodes: [],
    storyboard: { scenes: [] },
    sourceMeta: {},
  };

  const isFeishuOnly = Boolean(safeData.sourceMeta?.runtimeOnly);
  const viewTabs = isFeishuOnly ? FEISHU_ONLY_TABS : DEFAULT_VIEW_TABS;
  const stats = useMemo(() => buildProjectStats(safeData), [safeData]);
  const assetSummary = useMemo(() => buildAssetSummary(safeData), [safeData]);
  const riskSummary = useMemo(() => buildRiskSummary(safeData), [safeData]);
  const memberOptions = useMemo(
    () => (safeData.aiTeam ?? []).map((member) => ({ label: member.name, value: member.name })),
    [safeData.aiTeam],
  );
  const episodeOptions = useMemo(() => {
    const runtimeEpisodes = safeData.episodes?.length
      ? safeData.episodes.map((episode) => ({ label: episode.episode, value: episode.episode }))
      : [];

    if (runtimeEpisodes.length) return runtimeEpisodes;

    return [
      {
        label: safeData.project?.episodeLabel ?? "第一集",
        value: safeData.project?.episodeLabel ?? "第一集",
      },
    ];
  }, [safeData.episodes, safeData.project?.episodeLabel]);
  const filteredPriorities = useMemo(() => {
    const priorities = safeData.priorities ?? [];

    return priorities.filter((item) => {
      const memberMatched = selectedMemberFilter === "all" || item.owner === selectedMemberFilter;
      const episodeMatched =
        !selectedEpisodeFilter ||
        item.scope?.includes(selectedEpisodeFilter) ||
        selectedEpisodeFilter === safeData.project?.episodeLabel;

      return memberMatched && episodeMatched;
    });
  }, [safeData.priorities, safeData.project?.episodeLabel, selectedEpisodeFilter, selectedMemberFilter]);
  const groupedPriorities = useMemo(() => groupPriorities({ priorities: filteredPriorities }), [filteredPriorities]);
  const selectedMember = useMemo(
    () => getMemberByName(selectedMemberName, safeData),
    [safeData, selectedMemberName],
  );
  const activeMeta = VIEW_META[activeView] ?? VIEW_META.overview;
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }).format(new Date()),
    [],
  );
  const deadlineLabel = "2026-05-15";
  const deadlineCountdown = useMemo(() => {
    const today = new Date();
    const deadline = new Date(`${deadlineLabel}T00:00:00+08:00`);
    const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (Number.isNaN(diff)) return "";
    if (diff < 0) return `已超期 ${Math.abs(diff)} 天`;
    if (diff === 0) return "今天截止";
    return `距离第一集截止 ${diff} 天`;
  }, []);

  if (!dashboardData || !runtimeReady) {
    return <RuntimeEmptyState />;
  }

  function openMember(name) {
    setSelectedMemberName(name);
    setActiveView("team");
  }

  return (
    <div className="monster-dashboard">
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <div className="brand-mark">
              <OrbiterMark tone="neutral" />
            </div>
            <div className="brand-copy">
              <strong>{dashboardData.project?.name || "怪物"}</strong>
              <span>{dashboardData.project?.dateRangeLabel || "飞书实时数据"}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {viewTabs.map((tab) => (
              <ViewTab
                key={tab.key}
                isActive={activeView === tab.key}
                label={tab.label}
                shortLabel={tab.shortLabel}
                onClick={() => setActiveView(tab.key)}
              />
            ))}
          </nav>

          <div className="sidebar-stack">
            <div className="sidebar-metric">
              <span>同步条目</span>
              <strong>{dashboardData.project?.totalStoryboards || 0}</strong>
            </div>
            <div className="sidebar-metric">
              <span>已完成</span>
              <strong>{dashboardData.project?.completedStoryboards || 0}</strong>
            </div>
            <div className="sidebar-metric">
              <span>高风险</span>
              <strong>{riskSummary.high}</strong>
            </div>
          </div>
        </aside>

        <main className="dashboard-board">
          <header className="hero-card hero-card-minimal hero-slim-header">
            <div className="hero-slim-main">
              <div className="hero-title-inline">
                <span className="hero-kicker">MONSTER PRODUCTION HUB</span>
                <h1>{dashboardData.project?.title || "怪物制片台"}</h1>
              </div>

              <div className="hero-meta-inline">
                <span className="hero-meta-inline-chip">
                  <OrbiterMark tone="accent" small />
                  {activeMeta.title}
                </span>
                <span className="hero-meta-inline-chip">{dashboardData.project?.currentStage || "目前进度待同步"}</span>
                <span className="hero-meta-inline-chip">{todayLabel}</span>
                <span className="hero-meta-inline-chip hero-meta-inline-chip-alert">{deadlineCountdown}</span>
              </div>
            </div>

            <div className="hero-toolbar hero-toolbar-slim">
              <label className="hero-toolbar-field">
                <span>按成员筛选</span>
                <select value={selectedMemberFilter} onChange={(event) => setSelectedMemberFilter(event.target.value)}>
                  <option value="all">全部成员</option>
                  {memberOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="hero-toolbar-field">
                <span>按集数切换</span>
                <select value={selectedEpisodeFilter} onChange={(event) => setSelectedEpisodeFilter(event.target.value)}>
                  {episodeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>

          {activeView === "overview" ? (
            <OverviewView
              project={dashboardData.project}
              stats={stats}
              assets={assetSummary}
              risks={dashboardData.risks}
              groupedPriorities={groupedPriorities}
              onOpenMember={openMember}
              onOpenStoryboard={() => setActiveView("storyboard")}
            />
          ) : null}

          {activeView === "team" ? (
            <TeamView
              coreTeam={dashboardData.coreTeam || []}
              aiTeam={dashboardData.aiTeam || []}
              selectedMember={selectedMember}
              onSelectMember={setSelectedMemberName}
            />
          ) : null}

          {activeView === "plan" ? (
            <PlanView
              project={dashboardData.project}
              pipeline={dashboardData.pipeline || []}
              episodeSchedule={dashboardData.episodeSchedule || []}
              episodes={dashboardData.episodes || []}
            />
          ) : null}

          {activeView === "storyboard" ? (
            <StoryboardView
              storyboard={dashboardData.storyboard}
              aiTeam={dashboardData.aiTeam || []}
              selectedSceneId={selectedSceneId}
              storyboardFilter={storyboardFilter}
              onSelectScene={setSelectedSceneId}
              onChangeFilter={setStoryboardFilter}
            />
          ) : null}
        </main>
      </div>

      <nav className="dashboard-mobile-nav" aria-label="Mobile navigation">
        {viewTabs.map((tab) => (
          <BottomNavTab
            key={tab.key}
            isActive={activeView === tab.key}
            label={tab.label}
            shortLabel={tab.shortLabel}
            onClick={() => setActiveView(tab.key)}
          />
        ))}
      </nav>
    </div>
  );
}
