import { getStageMeta } from "../studio/config.js";
import { buildStagePatch, createStudioState, touchProject } from "../studio/storage.js";

const DEFAULT_FEISHU_LINK =
  "https://my.feishu.cn/base/R50TbtHBUadCtws42K0cfoQjnOf?table=tblyAieRq8DpEYN1&view=vew1s4zQx6";

const DEFAULT_STATUS_MAP = {
  "未开始": "pending",
  未启动: "pending",
  排队中: "pending",
  进行中: "active",
  制作中: "active",
  处理中: "active",
  待审核: "review",
  审核中: "review",
  待确认: "review",
  阻塞: "blocked",
  卡住: "blocked",
  暂停: "blocked",
  完成: "done",
  已完成: "done",
  已确认: "done",
};

const DEFAULT_MONSTER_FEISHU_CONFIG = {
  link: DEFAULT_FEISHU_LINK,
  baseId: "R50TbtHBUadCtws42K0cfoQjnOf",
  tableId: "tblyAieRq8DpEYN1",
  viewId: "vew1s4zQx6",
  projectName: "怪物",
  targetDeliveryDate: "2026-04-15",
  episodeCount: 1,
  defaultEpisode: 1,
  fields: {
    episode: ["集数", "分集", "第几集"],
    scene: ["分场", "场次"],
    shotNo: ["镜头号", "镜号"],
    description: ["文字描述", "画面描述"],
    dialogue: ["台词"],
    assignee: ["制作者", "负责人"],
    referenceImage: ["参考画面", "参考图", "参考画面图"],
    status: ["状态"],
    finalImage: ["确定画面", "最终画面"],
    updatedAt: ["更新时间", "更新于", "最后更新"],
    completedAt: ["完成日期", "完成时间"],
  },
  statusMap: DEFAULT_STATUS_MAP,
};

function canonicalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .toLowerCase();
}

function mergeConfig(base, extra = {}) {
  const fields = { ...(base.fields ?? {}), ...(extra.fields ?? {}) };
  const statusMap = { ...(base.statusMap ?? {}), ...(extra.statusMap ?? {}) };
  const merged = { ...base, ...extra, fields, statusMap };
  const parsed = parseFeishuBaseLink(merged.link);

  return {
    ...merged,
    baseId: merged.baseId || parsed.baseId,
    tableId: merged.tableId || parsed.tableId,
    viewId: merged.viewId || parsed.viewId,
  };
}

export function parseFeishuBaseLink(link) {
  if (!link) return { baseId: "", tableId: "", viewId: "" };

  try {
    const url = new URL(link);
    const parts = url.pathname.split("/").filter(Boolean);
    const baseIndex = parts.findIndex((part) => part === "base");
    const baseId = baseIndex >= 0 ? parts[baseIndex + 1] ?? "" : "";
    return {
      baseId,
      tableId: url.searchParams.get("table") ?? "",
      viewId: url.searchParams.get("view") ?? "",
    };
  } catch {
    return { baseId: "", tableId: "", viewId: "" };
  }
}

function getRuntimeConfig(overrides = {}) {
  const injected =
    typeof window !== "undefined" && window.MONSTER_FEISHU_CONFIG
      ? window.MONSTER_FEISHU_CONFIG
      : {};
  return mergeConfig(mergeConfig(DEFAULT_MONSTER_FEISHU_CONFIG, injected), overrides);
}

function resolveBitableSdk() {
  if (typeof window === "undefined") {
    throw new Error("飞书直读只支持浏览器环境。");
  }

  const sdk =
    window.bitable ||
    window.BITable ||
    window.MONSTER_FEISHU_SDK ||
    window.__MONSTER_FEISHU_SDK__;

  if (sdk?.base) return sdk;

  throw new Error(
    "未检测到飞书 Base JS-SDK。请把页面运行在飞书 Base 插件环境，或把 SDK 实例挂到 window.bitable。",
  );
}

function stringifyValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).filter(Boolean).join("、");
  }

  if (typeof value === "object") {
    if ("text" in value) return stringifyValue(value.text);
    if ("name" in value) return stringifyValue(value.name);
    if ("title" in value) return stringifyValue(value.title);
    if ("value" in value) return stringifyValue(value.value);
    if ("token" in value) return stringifyValue(value.token);
    if ("tmpUrl" in value) return stringifyValue(value.tmpUrl);
    if ("url" in value) return stringifyValue(value.url);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseEpisodeNumber(rawEpisode, defaultEpisode) {
  if (typeof rawEpisode === "number" && Number.isFinite(rawEpisode)) return rawEpisode;
  const match = String(rawEpisode ?? "").match(/\d+/);
  return match ? Number(match[0]) : defaultEpisode;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function toIsoOrEmpty(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function dayOnly(rawValue) {
  const iso = toIsoOrEmpty(rawValue);
  return iso ? iso.slice(0, 10) : "";
}

function computeWaitingHours(rawValue) {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - parsed.getTime()) / (1000 * 60 * 60)));
}

function normalizeStatus(rawStatus, row, statusMap) {
  const value = String(rawStatus ?? "").trim();
  if (value && statusMap[value]) return statusMap[value];

  if (row.finalImage) return "done";
  if (row.referenceImage || row.description || row.dialogue || row.assignee) return "active";
  return "pending";
}

function countIf(rows, predicate) {
  return rows.reduce((sum, row) => sum + (predicate(row) ? 1 : 0), 0);
}

function aggregateStatus(rows, completedCount, totalCount, startedPredicate) {
  if (!totalCount) return "pending";
  if (completedCount >= totalCount) return "done";
  if (rows.some((row) => row.status === "blocked")) return "blocked";
  if (rows.some((row) => row.status === "review")) return "review";
  if (rows.some(startedPredicate)) return "active";
  return "pending";
}

function summarizeAssignee(rows, fallback) {
  const assignees = unique(rows.map((row) => row.assignee));
  if (!assignees.length) return fallback;
  if (assignees.length === 1) return assignees[0];
  return `${assignees[0]} 等 ${assignees.length} 人`;
}

function latestTimestamp(rows) {
  return (
    rows
      .map((row) => row.updatedAt || row.completedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date().toISOString()
  );
}

function earliestTimestamp(rows) {
  return rows.map((row) => row.updatedAt || row.completedAt).filter(Boolean).sort()[0] ?? "";
}

function buildShotRows(records, config) {
  return records.map((record) => {
    const episode = parseEpisodeNumber(record.episode, config.defaultEpisode);
    const updatedAt = toIsoOrEmpty(record.updatedAt);
    const completedAt = toIsoOrEmpty(record.completedAt);

    const row = {
      recordId: record.recordId,
      episode,
      scene: String(record.scene || "未分场").trim() || "未分场",
      shotNo: String(record.shotNo || "").trim(),
      description: String(record.description || "").trim(),
      dialogue: String(record.dialogue || "").trim(),
      assignee: String(record.assignee || "").trim(),
      referenceImage: String(record.referenceImage || "").trim(),
      finalImage: String(record.finalImage || "").trim(),
      updatedAt,
      completedAt,
    };

    return {
      ...row,
      status: normalizeStatus(record.status, row, config.statusMap),
    };
  });
}

function buildDailyLogs(rows) {
  const byDate = new Map();

  rows.forEach((row) => {
    const storyboardDate = dayOnly(row.updatedAt);
    if (storyboardDate) {
      const list = byDate.get(storyboardDate) ?? [];
      list.push({
        episode: row.episode,
        stage: "episodeStoryboard",
        action: "output_logged",
        from: null,
        to: null,
        outputCount: 1,
        note: `${row.scene} ${row.shotNo || ""} 发生更新。`.trim(),
      });
      byDate.set(storyboardDate, list);
    }

    const imageDate = dayOnly(row.completedAt || (row.status === "done" ? row.updatedAt : ""));
    if (imageDate && row.finalImage) {
      const list = byDate.get(imageDate) ?? [];
      list.push({
        episode: row.episode,
        stage: "comicToImage",
        action: "output_logged",
        from: null,
        to: "done",
        outputCount: 1,
        note: `${row.scene} ${row.shotNo || ""} 图片分镜完成。`.trim(),
      });
      byDate.set(imageDate, list);
    }
  });

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => ({ date, entries }));
}

function patchEpisodeStages(episode, episodeRows) {
  const sceneCount = new Set(episodeRows.map((row) => row.scene)).size;
  const shotCount = episodeRows.length;
  const storyboardReadyCount = countIf(
    episodeRows,
    (row) => row.description || row.dialogue || row.referenceImage,
  );
  const finalImageCount = countIf(episodeRows, (row) => row.finalImage || row.status === "done");

  const storyboardUpdatedAt = latestTimestamp(episodeRows);
  const storyboardStartedAt = earliestTimestamp(episodeRows);
  const storyboardStage = {
    ...buildStagePatch(episode.stages.episodeStoryboard, {
      status: aggregateStatus(
        episodeRows,
        storyboardReadyCount,
        shotCount,
        (row) => row.description || row.dialogue || row.referenceImage,
      ),
      progress: shotCount ? Math.round((storyboardReadyCount / shotCount) * 100) : 0,
      outputCount: storyboardReadyCount,
      assignee: summarizeAssignee(episodeRows, getStageMeta("episodeStoryboard")?.assignee ?? ""),
      notes: `${sceneCount} 场 / ${shotCount} 镜，已完成文字或参考分镜 ${storyboardReadyCount} 镜。`,
      version: `feishu-${new Date().toISOString().slice(0, 10)}`,
      reviewWaitingHours:
        episodeRows.some((row) => row.status === "review") && storyboardUpdatedAt
          ? computeWaitingHours(storyboardUpdatedAt)
          : 0,
    }),
    updatedAt: storyboardUpdatedAt || episode.stages.episodeStoryboard.updatedAt,
    startedAt: storyboardStartedAt || episode.stages.episodeStoryboard.startedAt,
  };

  const imageUpdatedAt = latestTimestamp(
    episodeRows.filter((row) => row.finalImage || row.referenceImage || row.status === "done"),
  );
  const imageStartedAt = earliestTimestamp(
    episodeRows.filter((row) => row.finalImage || row.referenceImage || row.status !== "pending"),
  );
  const imageStage = {
    ...buildStagePatch(episode.stages.comicToImage, {
      status: aggregateStatus(
        episodeRows,
        finalImageCount,
        shotCount,
        (row) => row.finalImage || row.referenceImage,
      ),
      progress: shotCount ? Math.round((finalImageCount / shotCount) * 100) : 0,
      outputCount: finalImageCount,
      assignee: summarizeAssignee(episodeRows, getStageMeta("comicToImage")?.assignee ?? ""),
      notes: `${sceneCount} 场 / ${shotCount} 镜，已完成确定画面 ${finalImageCount} 镜。`,
      version: `feishu-${new Date().toISOString().slice(0, 10)}`,
      reviewWaitingHours:
        episodeRows.some((row) => row.status === "review") && imageUpdatedAt
          ? computeWaitingHours(imageUpdatedAt)
          : 0,
    }),
    updatedAt: imageUpdatedAt || episode.stages.comicToImage.updatedAt,
    startedAt: imageStartedAt || episode.stages.comicToImage.startedAt,
  };

  return {
    sceneCount,
    shotCount,
    storyboardReadyCount,
    finalImageCount,
    stages: {
      ...episode.stages,
      episodeStoryboard: storyboardStage,
      comicToImage: imageStage,
    },
  };
}

function buildSceneAssets(rows) {
  const sceneMap = new Map();
  rows.forEach((row) => {
    if (!sceneMap.has(row.scene)) {
      sceneMap.set(row.scene, {
        id: row.scene,
        name: row.scene,
        status: row.finalImage ? "done" : row.referenceImage ? "active" : "pending",
        designVersion: "",
        prompt: row.description,
        notes: `${row.shotNo || "未编号"} · ${row.assignee || "未分配"}`,
      });
    }
  });
  return [...sceneMap.values()];
}

function resolveFieldMeta(fieldMetaList, candidates) {
  const names = Array.isArray(candidates) ? candidates : [candidates];
  const normalizedCandidates = names.map((item) => canonicalize(item));

  return (
    fieldMetaList.find((field) => normalizedCandidates.includes(canonicalize(field.name))) ||
    fieldMetaList.find((field) =>
      normalizedCandidates.some((candidate) => canonicalize(field.name).startsWith(candidate)),
    ) ||
    null
  );
}

async function getFieldValue(table, recordId, fieldMeta) {
  if (!fieldMeta) return "";

  try {
    const rawString = await table.getCellString(fieldMeta.id, recordId);
    if (String(rawString ?? "").trim()) return String(rawString).trim();
  } catch {}

  try {
    const field = await table.getField(fieldMeta.id);
    const cell = await field.getCell(recordId);
    const rawValue = await cell.getValue();
    return stringifyValue(rawValue);
  } catch {
    return "";
  }
}

async function readVisibleRecords(table, viewId) {
  if (viewId && table.getViewById) {
    try {
      const view = await table.getViewById(viewId);
      if (view?.getVisibleRecordIdList) {
        const ids = await view.getVisibleRecordIdList();
        return ids.filter(Boolean);
      }
    } catch {}
  }

  if (table.getRecordIdList) {
    return table.getRecordIdList();
  }

  throw new Error("当前 SDK 无法获取记录列表。");
}

async function readStoryboardRecordsFromTable(table, config) {
  const fieldMetaList = await table.getFieldMetaList();
  const resolvedFields = Object.fromEntries(
    Object.entries(config.fields).map(([key, candidates]) => [key, resolveFieldMeta(fieldMetaList, candidates)]),
  );
  const recordIds = await readVisibleRecords(table, config.viewId);

  const records = await Promise.all(
    recordIds.map(async (recordId) => ({
      recordId,
      episode: await getFieldValue(table, recordId, resolvedFields.episode),
      scene: await getFieldValue(table, recordId, resolvedFields.scene),
      shotNo: await getFieldValue(table, recordId, resolvedFields.shotNo),
      description: await getFieldValue(table, recordId, resolvedFields.description),
      dialogue: await getFieldValue(table, recordId, resolvedFields.dialogue),
      assignee: await getFieldValue(table, recordId, resolvedFields.assignee),
      referenceImage: await getFieldValue(table, recordId, resolvedFields.referenceImage),
      status: await getFieldValue(table, recordId, resolvedFields.status),
      finalImage: await getFieldValue(table, recordId, resolvedFields.finalImage),
      updatedAt: await getFieldValue(table, recordId, resolvedFields.updatedAt),
      completedAt: await getFieldValue(table, recordId, resolvedFields.completedAt),
    })),
  );

  return records.filter((record) => record.scene || record.shotNo || record.description || record.dialogue);
}

function buildStudioStateFromStoryboardRows(rows, config) {
  const episodeNumbers = unique(rows.map((row) => row.episode)).sort((left, right) => left - right);
  const inferredEpisodeCount = episodeNumbers.length ? Math.max(...episodeNumbers) : config.defaultEpisode;
  const episodeCount = Math.max(config.episodeCount || 0, inferredEpisodeCount || 1);

  const state = createStudioState({
    name: config.projectName,
    episodeCount,
    targetDeliveryDate: config.targetDeliveryDate,
    seedDemo: false,
  });

  const rowsByEpisode = new Map();
  rows.forEach((row) => {
    const list = rowsByEpisode.get(row.episode) ?? [];
    list.push(row);
    rowsByEpisode.set(row.episode, list);
  });

  state.episodes = state.episodes.map((episode) => {
    const episodeRows = rowsByEpisode.get(episode.episode) ?? [];
    const patched = patchEpisodeStages(episode, episodeRows);

    return {
      ...episode,
      summary:
        episodeRows.length > 0
          ? `${patched.sceneCount} 场 / ${patched.shotCount} 镜，图片分镜已完成 ${patched.finalImageCount} 镜。`
          : "当前集尚未同步到分镜表。",
      stages: patched.stages,
    };
  });

  state.dailyLogs = buildDailyLogs(rows);
  state.assets = {
    characters: [],
    scenes: buildSceneAssets(rows),
    storyboardRows: rows,
  };
  state.project = touchProject(state.project, {
    teamMembers: unique(rows.map((row) => row.assignee)),
    lastSyncedAt: new Date().toISOString(),
    currentView: "overview",
    source: {
      type: "feishu-bitable",
      link: config.link,
      baseId: config.baseId,
      tableId: config.tableId,
      viewId: config.viewId,
    },
  });

  return state;
}

export async function readFeishuStoryboardState(overrides = {}) {
  const sdk = resolveBitableSdk();
  const config = getRuntimeConfig(overrides);
  const { baseId, tableId } = config;

  if (!baseId || !tableId) {
    throw new Error("飞书链接里缺少 baseId 或 tableId。");
  }

  const selection = sdk.base.getSelection ? await sdk.base.getSelection() : null;
  if (selection?.baseId && selection.baseId !== baseId) {
    console.warn("当前打开的飞书 Base 与配置链接不一致，将按配置中的 tableId 强制读取。");
  }

  let table = null;
  if (sdk.base.getTableById) {
    table = await sdk.base.getTableById(tableId);
  }
  if (!table && sdk.base.getTable) {
    table = await sdk.base.getTable(tableId);
  }
  if (!table) {
    throw new Error("无法通过 tableId 获取飞书数据表实例。");
  }

  const rawRecords = await readStoryboardRecordsFromTable(table, config);
  const shotRows = buildShotRows(rawRecords, config);
  return buildStudioStateFromStoryboardRows(shotRows, config);
}

export function installMonsterFeishuBridge(overrides = {}) {
  if (typeof window === "undefined") return;

  window.MONSTER_FEISHU_CONFIG = getRuntimeConfig(overrides);
  window.readFeishuStudioState = () => readFeishuStoryboardState(window.MONSTER_FEISHU_CONFIG);
  window.MONSTER_FEISHU_DEBUG = {
    parseFeishuBaseLink,
    readFeishuStoryboardState,
  };
}
