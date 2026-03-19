import React, { useMemo, useState } from "react";
import "../dashboard.css";
import {
  baseData,
  buildAssetSummary,
  buildProjectStats,
  buildRiskSummary,
  getMemberByName,
  groupPriorities,
} from "./dashboardModel.js";
import { BottomNavTab, OrbiterMark, ViewTab } from "./dashboard/ui.jsx";
import OverviewView from "./dashboard/OverviewView.jsx";
import TeamView from "./dashboard/TeamView.jsx";
import PlanView from "./dashboard/PlanView.jsx";
import StoryboardView from "./dashboard/StoryboardView.jsx";

const VIEW_TABS = [
  { key: "overview", label: "总览", shortLabel: "总" },
  { key: "team", label: "团队", shortLabel: "队" },
  { key: "plan", label: "管线", shortLabel: "线" },
  { key: "storyboard", label: "分镜", shortLabel: "镜" },
];

const VIEW_META = {
  overview: {
    kicker: "SYSTEM OVERVIEW",
    title: "项目全局信号",
    description: "把进度、资产、团队与当日行动压进同一张轻量面板里，先看总控，再决定下钻方向。",
  },
  team: {
    kicker: "TEAM MATRIX",
    title: "团队与算力分配",
    description: "核心管理团队负责判断，AI 制作团队负责执行。默认只看最紧急的推进信号，细节在下方展开。",
  },
  plan: {
    kicker: "PIPELINE MAP",
    title: "制作管线排期",
    description: "从剧本开发到正片提交，按阶段核对主档期，再对齐 6 集的推进窗口。",
  },
  storyboard: {
    kicker: "STORYBOARD GRID",
    title: "分镜重分配明细",
    description: "按场次查看当前镜头归属、执行状态和问题标签，直接落到最细颗粒度的生产数据。",
  },
};

export default function Dashboard() {
  const [activeView, setActiveView] = useState("overview");
  const [selectedMemberName, setSelectedMemberName] = useState(baseData.aiTeam[0]?.name ?? "");
  const [selectedSceneId, setSelectedSceneId] = useState(baseData.storyboard.scenes[0]?.sceneId ?? "");
  const [storyboardFilter, setStoryboardFilter] = useState("all");

  const stats = useMemo(() => buildProjectStats(baseData), []);
  const assetSummary = useMemo(() => buildAssetSummary(baseData), []);
  const riskSummary = useMemo(() => buildRiskSummary(baseData), []);
  const groupedPriorities = useMemo(() => groupPriorities(baseData), []);

  const selectedMember = useMemo(() => getMemberByName(selectedMemberName, baseData), [selectedMemberName]);
  const activeMeta = VIEW_META[activeView];

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
              <strong>怪物</strong>
              <span>{baseData.project.dateRangeLabel}</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {VIEW_TABS.map((tab) => (
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
              <span>镜头池</span>
              <strong>{baseData.project.totalStoryboards}</strong>
            </div>
            <div className="sidebar-metric">
              <span>第 1 集</span>
              <strong>{baseData.project.completedStoryboards}</strong>
            </div>
            <div className="sidebar-metric">
              <span>高风险</span>
              <strong>{riskSummary.high}</strong>
            </div>
          </div>
        </aside>

        <main className="dashboard-board">
          <header className="hero-card hero-card-minimal">
            <div className="hero-copy">
              <span className="hero-kicker">MONSTER PRODUCTION HUB</span>
              <h1>怪物制片台</h1>
            </div>

            <div className="hero-meta-strip">
              <span className="hero-meta-chip">
                <OrbiterMark tone="accent" small />
                {activeMeta.title}
              </span>
              <span className="hero-meta-chip">{baseData.project.startDate} - {baseData.project.endDate}</span>
              <span className="hero-meta-chip">{baseData.project.currentStage}</span>
            </div>
          </header>

          {activeView === "overview" ? (
            <OverviewView
              project={baseData.project}
              stats={stats}
              episodes={baseData.episodes}
              aiTeam={baseData.aiTeam}
              coreTeam={baseData.coreTeam}
              assetSummary={baseData.assetSummary}
              assets={assetSummary}
              risks={baseData.risks}
              groupedPriorities={groupedPriorities}
              onOpenMember={openMember}
              onOpenStoryboard={() => setActiveView("storyboard")}
            />
          ) : null}

          {activeView === "team" ? (
            <TeamView
              coreTeam={baseData.coreTeam}
              aiTeam={baseData.aiTeam}
              selectedMember={selectedMember}
              onSelectMember={setSelectedMemberName}
            />
          ) : null}

          {activeView === "plan" ? (
            <PlanView
              project={baseData.project}
              pipeline={baseData.pipeline}
              episodeSchedule={baseData.episodeSchedule}
              episodes={baseData.episodes}
            />
          ) : null}

          {activeView === "storyboard" ? (
            <StoryboardView
              storyboard={baseData.storyboard}
              aiTeam={baseData.aiTeam}
              selectedSceneId={selectedSceneId}
              storyboardFilter={storyboardFilter}
              onSelectScene={setSelectedSceneId}
              onChangeFilter={setStoryboardFilter}
            />
          ) : null}
        </main>
      </div>

      <nav className="dashboard-mobile-nav" aria-label="Mobile navigation">
        {VIEW_TABS.map((tab) => (
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
