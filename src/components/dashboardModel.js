import baseData from "../data/monsterProjectDashboard.json";

export { baseData };

export const STATUS_META = {
  进行中: { label: "进行中", tone: "warning" },
  准备中: { label: "准备中", tone: "neutral" },
  未开始: { label: "未开始", tone: "danger" },
  基本完成: { label: "基本完成", tone: "good" },
  完成: { label: "完成", tone: "good" },
  关注中: { label: "关注中", tone: "warning" },
  监控中: { label: "监控中", tone: "neutral" },
  紧急: { label: "紧急", tone: "danger" },
  待观察: { label: "待观察", tone: "neutral" },
  大纲中: { label: "大纲中", tone: "neutral" },
  主线梳理中: { label: "主线梳理中", tone: "warning" },
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
  return (data.storyboard?.scenes ?? []).reduce(
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

function parseDateLike(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const fromTimestamp = new Date(numeric);
    if (!Number.isNaN(fromTimestamp.getTime())) return fromTimestamp;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatMonthDay(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function buildProgressHistory(data = baseData) {
  const sceneRows = data.storyboard?.sceneRows ?? [];
  const completedDates = sceneRows
    .filter((row) => String(row.sceneStatus ?? "").includes("完成"))
    .map((row) => parseDateLike(row.imageDoneAt) || parseDateLike(row.videoDoneAt))
    .filter(Boolean)
    .map((date) => startOfDay(date));

  const today = startOfDay(new Date());
  const latestDate =
    completedDates.length > 0
      ? new Date(Math.max(today.getTime(), ...completedDates.map((date) => date.getTime())))
      : today;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(latestDate);
    date.setDate(latestDate.getDate() - (6 - index));
    return startOfDay(date);
  });

  const byDay = new Map();
  completedDates.forEach((date) => {
    const key = startOfDay(date).getTime();
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  });

  let cumulative = 0;
  return days.map((date) => {
    const key = date.getTime();
    const completed = byDay.get(key) ?? 0;
    cumulative += completed;
    return {
      label: formatMonthDay(date),
      completed,
      cumulative,
      percent: percent(cumulative, data.project?.totalStoryboards ?? 0),
    };
  });
}

export function buildProjectStats(data = baseData) {
  const shotSummary = summarizeStoryboardShots(data);
  const progressHistory = buildProgressHistory(data);
  const yesterday = progressHistory.at(-2);
  const todayPoint = progressHistory.at(-1);
  const yesterdayDeltaShots = Math.max(0, (todayPoint?.cumulative ?? 0) - (yesterday?.cumulative ?? 0));
  const yesterdayDeltaPercent = Number(((todayPoint?.percent ?? 0) - (yesterday?.percent ?? 0)).toFixed(1));
  const teamDailyTarget = (data.aiTeam ?? []).reduce((sum, item) => sum + (item.dailyTarget ?? 0), 0);
  const remainingShots = Math.max(0, (data.project?.totalStoryboards ?? 0) - (data.project?.completedStoryboards ?? 0));
  const estimatedDays = teamDailyTarget > 0 ? Math.ceil(remainingShots / teamDailyTarget) : 0;
  const estimatedCompletionDate = (() => {
    if (!estimatedDays) return "";
    const date = new Date();
    date.setDate(date.getDate() + estimatedDays);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  })();

  return {
    totalEpisodes: data.project?.episodeCount ?? 0,
    totalShots: data.project?.totalStoryboards ?? 0,
    doneShots: data.project?.completedStoryboards ?? 0,
    revisionShots: shotSummary.revision,
    pendingShots: shotSummary.pending,
    episodeOneProgress: percent(data.episodes?.[0]?.done ?? 0, data.episodes?.[0]?.totalShots ?? 0),
    assetProgress: percent(data.project?.assetCompleted ?? 0, data.project?.assetTotal ?? 0),
    teamDailyTarget,
    aiTrackedShots: data.storyboard?.trackedShots ?? data.project?.trackedShots ?? 0,
    completedAssets: data.project?.assetCompleted ?? 0,
    currentPhase: data.project?.currentStage ?? "",
    scriptStage: data.project?.scriptProgress ?? "",
    remainingShots,
    estimatedDays,
    estimatedCompletionDate,
    yesterdayDeltaShots,
    yesterdayDeltaPercent,
    progressHistory,
    shotSummary,
  };
}

export function buildEpisodeColorMap(data = baseData) {
  return Object.fromEntries((data.episodes ?? []).map((episode) => [episode.episode, episode.color]));
}

export function groupPriorities(data = baseData) {
  return (data.priorities ?? []).reduce(
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
    high: (data.risks ?? []).filter((risk) => risk.impact === "高").length,
    medium: (data.risks ?? []).filter((risk) => risk.impact === "中").length,
    urgent: (data.risks ?? []).filter((risk) => risk.status === "紧急").length,
  };
}

export function getMemberByName(name, data = baseData) {
  return (data.aiTeam ?? []).find((member) => member.name === name) ?? data.aiTeam?.[0] ?? null;
}

export function getSceneById(sceneId, data = baseData) {
  return (data.storyboard?.scenes ?? []).find((scene) => scene.sceneId === sceneId) ?? data.storyboard?.scenes?.[0] ?? null;
}

export function buildSceneOwnerSummary(scene) {
  if (scene?.ownerSummary) return scene.ownerSummary;
  if (scene?.assignments?.length) {
    return scene.assignments.map((item) => `${item.owner} ${item.assignedShots}镜`).join(" / ");
  }

  return (scene?.owners ?? []).map((owner) => `${owner.name} ${owner.shots}镜`).join(" / ");
}

export function buildAssetSummary(data = baseData) {
  return (data.assets ?? []).map((asset) => ({
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
