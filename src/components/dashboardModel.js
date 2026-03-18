import baseData from "../data/monsterProjectDashboard.json";

export { baseData };

export const STATUS_META = {
  "进行中": { label: "进行中", tone: "warning" },
  "准备中": { label: "准备中", tone: "neutral" },
  "未开始": { label: "未开始", tone: "danger" },
  "基本完成": { label: "基本完成", tone: "good" },
  "完成": { label: "完成", tone: "good" },
  "关注中": { label: "关注中", tone: "warning" },
  "监控中": { label: "监控中", tone: "neutral" },
  "紧急": { label: "紧急", tone: "danger" },
  "待观察": { label: "待观察", tone: "neutral" },
  "大纲中": { label: "大纲中", tone: "neutral" },
  "主线梳理中": { label: "主线梳理中", tone: "warning" },
};

export const PRIORITY_META = {
  P0: { label: "P0", tone: "danger" },
  P1: { label: "P1", tone: "warning" },
  P2: { label: "P2", tone: "neutral" },
};

export const SHOT_STATUS_META = {
  完成: { label: "完成", tone: "good" },
  修改中: { label: "修改中", tone: "warning" },
  未开始: { label: "未开始", tone: "danger" },
  已删除: { label: "已删除", tone: "neutral" },
};

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function getStatusMeta(label) {
  return STATUS_META[label] ?? { label: label || "未开始", tone: "neutral" };
}

export function getPriorityMeta(priorityLabel) {
  const key = String(priorityLabel ?? "").match(/P\d/)?.[0] ?? "P2";
  return PRIORITY_META[key] ?? PRIORITY_META.P2;
}

export function getShotStatusMeta(label) {
  return SHOT_STATUS_META[label] ?? SHOT_STATUS_META["未开始"];
}

export function summarizeStoryboardShots(data = baseData) {
  return data.storyboard.scenes.reduce(
    (summary, scene) => {
      summary.done += scene.confirmedShots ?? 0;
      summary.revision += scene.revisionShots ?? 0;
      summary.pending += scene.pendingShots ?? 0;
      summary.deleted += scene.deletedShots ?? 0;
      return summary;
    },
    { done: 0, revision: 0, pending: 0, deleted: 0 },
  );
}

export function buildHealthStatus(data = baseData) {
  const shotSummary = summarizeStoryboardShots(data);
  const urgentRiskCount = data.risks.filter((risk) => risk.status === "紧急").length;
  const loadList = data.aiTeam
    .filter((member) => member.name !== "张叶湘")
    .map((member) => member.remainingWorkload);
  const maxLoad = Math.max(...loadList, 0);
  const minLoad = Math.min(...loadList, maxLoad);
  const activeScenes = data.storyboard.scenes.filter((scene) => (scene.pendingShots ?? 0) + (scene.revisionShots ?? 0) > 0).length;
  const triggers = [];
  let score = 0;

  if ((data.project.scriptProgress ?? "").includes("主线梳理")) {
    score += 2;
    triggers.push("剧本仍停留在主线梳理");
  } else if ((data.project.scriptProgress ?? "").includes("大纲")) {
    score += 1;
    triggers.push("剧本仅推进到大纲阶段");
  }

  if ((data.project.assetCompleted ?? 0) < 40) {
    score += 2;
    triggers.push("资产完成数低于 40");
  } else if ((data.project.assetCompleted ?? 0) < 60) {
    score += 1;
    triggers.push("资产完成数尚未达到 60");
  }

  if (shotSummary.revision > 30) {
    score += 2;
    triggers.push("返修镜头超过 30");
  } else if (shotSummary.revision > 10) {
    score += 1;
    triggers.push("返修镜头超过 10");
  }

  if (shotSummary.pending > 180) {
    score += 2;
    triggers.push("待制作镜头超过 180");
  } else if (shotSummary.pending > 120) {
    score += 1;
    triggers.push("待制作镜头超过 120");
  }

  if (urgentRiskCount >= 2) {
    score += 2;
    triggers.push("存在 2 项以上紧急风险");
  } else if (urgentRiskCount >= 1) {
    score += 1;
    triggers.push("存在紧急风险");
  }

  if (maxLoad - minLoad > 15) {
    score += 1;
    triggers.push("成员负载差超过 15 镜");
  }

  if (activeScenes > 8) {
    score += 1;
    triggers.push("同时活跃场次超过 8 场");
  }

  if (score >= 6) {
    return {
      label: "红灯",
      tone: "danger",
      note: triggers.slice(0, 2).join(" · "),
      triggers,
      score,
    };
  }

  if (score >= 3) {
    return {
      label: "黄灯",
      tone: "warning",
      note: triggers.slice(0, 2).join(" · "),
      triggers,
      score,
    };
  }

  return {
    label: "绿灯",
    tone: "good",
    note: triggers[0] || "当前关键阈值均在健康区间",
    triggers,
    score,
  };
}

export function buildProjectStats(data = baseData) {
  const shotSummary = summarizeStoryboardShots(data);
  const revision = shotSummary.revision;
  const pending = shotSummary.pending;
  const done = data.episodes.reduce((sum, item) => sum + item.done, 0);

  return {
    totalEpisodes: data.project.episodeCount,
    totalShots: data.project.totalStoryboards,
    doneShots: data.project.completedStoryboards,
    revisionShots: revision,
    pendingShots: pending,
    episodeOneProgress: percent(data.episodes[0]?.done ?? 0, data.episodes[0]?.totalShots ?? 0),
    assetProgress: percent(data.project.assetCompleted, data.project.assetTotal),
    teamDailyTarget: data.aiTeam.reduce((sum, item) => sum + item.dailyTarget, 0),
    aiTrackedShots: data.storyboard.trackedShots,
    completedAssets: data.project.assetCompleted,
    health: buildHealthStatus(data),
    currentPhase: data.project.currentStage,
    scriptStage: data.project.scriptProgress,
    allDoneShots: done,
    shotSummary,
  };
}

export function buildEpisodeColorMap(data = baseData) {
  return Object.fromEntries(data.episodes.map((episode) => [episode.episode, episode.color]));
}

export function groupPriorities(data = baseData) {
  return data.priorities.reduce(
    (accumulator, item) => {
      const key = String(item.priority ?? "").startsWith("P0")
        ? "P0"
        : String(item.priority ?? "").startsWith("P1")
          ? "P1"
          : "P2";
      accumulator[key].push(item);
      return accumulator;
    },
    { P0: [], P1: [], P2: [] },
  );
}

export function buildRiskSummary(data = baseData) {
  return {
    high: data.risks.filter((risk) => risk.impact === "高").length,
    medium: data.risks.filter((risk) => risk.impact === "中").length,
    urgent: data.risks.filter((risk) => risk.status === "紧急").length,
  };
}

export function getMemberByName(name, data = baseData) {
  return data.aiTeam.find((member) => member.name === name) ?? data.aiTeam[0];
}

export function getSceneById(sceneId, data = baseData) {
  return data.storyboard.scenes.find((scene) => scene.sceneId === sceneId) ?? data.storyboard.scenes[0];
}

export function buildSceneOwnerSummary(scene) {
  if (scene.ownerSummary) return scene.ownerSummary;
  if (scene.assignments?.length) {
    return scene.assignments.map((item) => `${item.owner} ${item.assignedShots}镜`).join(" · ");
  }
  return scene.owners
    .map((owner) => `${owner.name} ${owner.shots}镜`)
    .join(" · ");
}

export function buildAssetSummary(data = baseData) {
  return data.assets.map((asset) => ({
    ...asset,
    progressLabel: `${asset.done}/${asset.total}`,
  }));
}

export function buildPipelineRange(stage, project = baseData.project) {
  const totalDays =
    (new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24) || 1;
  const startOffset =
    (new Date(stage.startDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24);
  const duration =
    (new Date(stage.endDate).getTime() - new Date(stage.startDate).getTime()) / (1000 * 60 * 60 * 24) || 1;

  return {
    left: `${Math.max(0, (startOffset / totalDays) * 100)}%`,
    width: `${Math.max(2, (duration / totalDays) * 100)}%`,
  };
}

export function monthColumns() {
  return ["2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月"];
}
