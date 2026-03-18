import React, { useMemo } from "react";
import { buildSceneOwnerSummary } from "../dashboardModel.js";
import { DataPair, StatusBadge } from "./ui.jsx";

function buildFilters(aiTeam) {
  return [
    { key: "all", label: "全部" },
    ...aiTeam.map((member) => ({ key: member.name, label: member.name })),
    { key: "完成", label: "完成" },
    { key: "修改中", label: "修改中" },
    { key: "未开始", label: "未开始" },
    { key: "已删除", label: "已删除" },
  ];
}

function matchesShot(shot, filterKey) {
  if (filterKey === "all") return true;
  return shot.owner === filterKey || shot.status === filterKey;
}

export default function StoryboardView({
  storyboard,
  aiTeam,
  selectedSceneId,
  storyboardFilter,
  onSelectScene,
  onChangeFilter,
}) {
  const filters = useMemo(() => buildFilters(aiTeam), [aiTeam]);

  const filteredScenes = useMemo(() => {
    if (storyboardFilter === "all") return storyboard.scenes;
    return storyboard.scenes.filter((scene) => scene.shots.some((shot) => matchesShot(shot, storyboardFilter)));
  }, [storyboard.scenes, storyboardFilter]);

  const activeScene = useMemo(() => {
    return filteredScenes.find((scene) => scene.sceneId === selectedSceneId) ?? filteredScenes[0] ?? null;
  }, [filteredScenes, selectedSceneId]);

  const sceneShots = useMemo(() => {
    if (!activeScene) return [];
    return activeScene.shots.filter((shot) => matchesShot(shot, storyboardFilter));
  }, [activeScene, storyboardFilter]);

  return (
    <section className="project-view-stack">
      <div className="filter-row">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`filter-chip ${storyboardFilter === filter.key ? "is-active" : ""}`}
            onClick={() => onChangeFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="scene-switch-row">
        {filteredScenes.map((scene) => (
          <button
            key={scene.sceneId}
            type="button"
            className={`scene-switch-chip ${selectedSceneId === scene.sceneId ? "is-active" : ""}`}
            onClick={() => onSelectScene(scene.sceneId)}
          >
            <span>{scene.sceneName}</span>
            <small>{scene.totalShots} 镜</small>
          </button>
        ))}
      </div>

      <article className="card section-card scene-detail-column">
        {activeScene ? (
          <>
            <div className="section-head section-head-compact">
              <div>
                <h2>{activeScene.sceneName}</h2>
              </div>
              <StatusBadge value={activeScene.pendingShots > 0 || activeScene.revisionShots > 0 ? "进行中" : "完成"} />
            </div>

            <div className="detail-pair-grid detail-pair-grid-five">
              <DataPair label="类型" value={activeScene.sceneType || "未标注"} />
              <DataPair label="总镜数" value={`${activeScene.totalShots} 镜`} />
              <DataPair label="原负责人" value={activeScene.originalOwner || "多负责人"} />
              <DataPair label="新分配" value={buildSceneOwnerSummary(activeScene)} />
              <DataPair label="进度" value={`${activeScene.confirmedShots} / ${activeScene.revisionShots} / ${activeScene.pendingShots}`} meta="完成 / 修改中 / 未开始" />
            </div>

            <div className="compact-table">
              <div className="table-head assignment-table">
                <span>新负责人</span>
                <span>分组</span>
                <span>分配镜头</span>
                <span>已确认</span>
                <span>需修改</span>
                <span>待制作</span>
                <span>说明</span>
              </div>
              <div className="table-body">
                {activeScene.assignments.map((assignment, index) => (
                  <div key={`${activeScene.sceneId}-assignment-${index}`} className="table-row assignment-table">
                    <span>{assignment.owner}</span>
                    <span>{assignment.group}</span>
                    <span>{assignment.assignedShots}</span>
                    <span>{assignment.confirmed || "-"}</span>
                    <span>{assignment.revision || "-"}</span>
                    <span>{assignment.pending || "-"}</span>
                    <span>{assignment.note || "-"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="compact-table">
              <div className="table-head storyboard-shot-table-wide">
                <span>镜头 ID</span>
                <span>原制作者</span>
                <span>新制作者</span>
                <span>状态</span>
                <span>优先级</span>
                <span>类型</span>
                <span>问题 / 修改意见</span>
              </div>
              <div className="table-body">
                {sceneShots.map((shot) => (
                  <div key={`${activeScene.sceneId}-${shot.sequence}`} className="table-row storyboard-shot-table-wide">
                    <span className="mono-text">{shot.shotId}</span>
                    <span>{shot.originalOwner}</span>
                    <span>{shot.owner}</span>
                    <span>
                      <StatusBadge value={shot.status} kind="shot" />
                    </span>
                    <span>
                      <StatusBadge value={shot.priority} kind="priority" />
                    </span>
                    <span>{shot.type}</span>
                    <span>{shot.issueTags.join(" / ")}{shot.directorNote ? ` · ${shot.directorNote}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="section-head section-head-compact">
            <div>
              <h2>没有匹配的场次</h2>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
