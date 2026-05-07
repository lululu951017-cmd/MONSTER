import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const BASE_URL = "https://open.feishu.cn";
const DEFAULT_CONFIG_PATH = "scripts/feishu-sync/monster-scene.config.json";
const DEFAULT_OUTPUT_PATH = "public/monsterProjectDashboard.runtime.json";
const DEFAULT_ENV_PATH = ".env.local";

const STORYBOARD_STATUS_MAP = {
  制作完成: "done",
  已完成: "done",
  完成: "done",
  新增返修: "revision",
  需返修: "revision",
  返修中: "revision",
  制作中: "pending",
  进行中: "pending",
  未开始: "pending",
  待制作: "pending",
};

const ASSET_STATUS_MAP = {
  制作完成: "done",
  已完成: "done",
  完成: "done",
  制作中: "inProgress",
  进行中: "inProgress",
  未开始: "pending",
  待制作: "pending",
};

const CHINESE_NUMERALS = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
  十三: 13,
  十四: 14,
  十五: 15,
  十六: 16,
  十七: 17,
  十八: 18,
  十九: 19,
  二十: 20,
};

function parseArgs(argv) {
  const args = {
    configPath: DEFAULT_CONFIG_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--config" && argv[index + 1]) {
      args.configPath = argv[index + 1];
      index += 1;
    } else if (current === "--output" && argv[index + 1]) {
      args.outputPath = argv[index + 1];
      index += 1;
    } else if (current === "--help" || current === "-h") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Export Feishu scene-level data into a runtime dashboard JSON.

Usage:
  node scripts/feishu-sync/export-monster-scene-runtime.js

Options:
  --config <path>   Config JSON path.
  --output <path>   Runtime dashboard JSON output path.
  --help            Show this help message.
`);
}

function resolveFromRoot(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(ROOT_DIR, targetPath);
}

async function loadJson(targetPath) {
  const absolutePath = resolveFromRoot(targetPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw);
}

async function saveJson(targetPath, value) {
  const absolutePath = resolveFromRoot(targetPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadLocalEnvFile(filePath = DEFAULT_ENV_PATH) {
  const absolutePath = resolveFromRoot(filePath);

  try {
    const raw = await fs.readFile(absolutePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function canonicalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function unwrapValue(value) {
  if (Array.isArray(value)) {
    if (!value.length) return "";
    return value
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") return String(item);
        return item.text ?? item.name ?? item.value ?? item.id ?? item.title ?? item.url ?? "";
      })
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    return value.text ?? value.name ?? value.value ?? value.id ?? value.title ?? value.url ?? "";
  }
  return value ?? "";
}

function getFieldValue(record, candidates) {
  if (!record?.fields) return "";
  const names = Array.isArray(candidates) ? candidates : [candidates];

  for (const name of names) {
    if (name in record.fields) {
      const value = String(unwrapValue(record.fields[name]) ?? "").trim();
      if (value) return value;
    }
  }

  const normalizedRecordFields = Object.fromEntries(
    Object.entries(record.fields).map(([key, value]) => [canonicalize(key), value]),
  );

  for (const name of names) {
    const value = String(unwrapValue(normalizedRecordFields[canonicalize(name)]) ?? "").trim();
    if (value) return value;
  }

  return "";
}

function getEnvOrThrow(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  if (data.code && data.code !== 0) {
    throw new Error(`Feishu API error ${data.code}: ${data.msg}`);
  }

  return data.data ?? data;
}

async function fetchTenantAccessToken() {
  const data = await requestJson(`${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: getEnvOrThrow("FEISHU_APP_ID"),
      app_secret: getEnvOrThrow("FEISHU_APP_SECRET"),
    }),
  });

  if (!data.tenant_access_token) {
    throw new Error("Feishu response did not contain tenant_access_token.");
  }

  return data.tenant_access_token;
}

async function listRecords({ appToken, tableId, tenantAccessToken, pageSize = 500 }) {
  const items = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    params.set("page_size", String(pageSize));
    if (pageToken) params.set("page_token", pageToken);

    const data = await requestJson(
      `${BASE_URL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tenantAccessToken}`,
        },
      },
    );

    items.push(...(data.items ?? []));
    hasMore = Boolean(data.has_more);
    pageToken = data.page_token ?? "";
  }

  return items;
}

function normalizeSceneStatus(value) {
  return STORYBOARD_STATUS_MAP[String(value || "").trim()] ?? "pending";
}

function normalizeAssetStatus(value) {
  return ASSET_STATUS_MAP[String(value || "").trim()] ?? "pending";
}

function summarizeOwnerList(rawValue) {
  return String(rawValue || "")
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sceneNumberFromName(sceneName) {
  const match = String(sceneName).match(/^第(.+?)场$/);
  if (!match) return 0;
  return CHINESE_NUMERALS[match[1]] ?? 0;
}

function sceneCodeFromName(sceneName) {
  const number = sceneNumberFromName(sceneName);
  return `S${String(number || 0).padStart(2, "0")}`;
}

function buildSceneRows(records, fieldConfig) {
  return records
    .map((record, index) => {
      const sceneName = getFieldValue(record, fieldConfig.sceneName);
      return {
        rowId: record.record_id || `row-${index + 1}`,
        sceneName,
        sceneNumber: sceneNumberFromName(sceneName),
        sceneCode: sceneCodeFromName(sceneName),
        scriptContent: getFieldValue(record, fieldConfig.scriptContent),
        sceneStatus: getFieldValue(record, fieldConfig.sceneStatus),
        imageOwner: getFieldValue(record, fieldConfig.imageOwner),
        level: getFieldValue(record, fieldConfig.level),
        imageDoneAt: getFieldValue(record, fieldConfig.imageDoneAt),
        videoOwner: getFieldValue(record, fieldConfig.videoOwner),
        videoDoneAt: getFieldValue(record, fieldConfig.videoDoneAt),
      };
    })
    .filter((row) => row.sceneName);
}

function buildAssetRows(records, fieldConfig, fallbackCategory) {
  return records
    .map((record, index) => ({
      rowId: record.record_id || `asset-${index + 1}`,
      name:
        getFieldValue(record, fieldConfig.name) ||
        getFieldValue(record, fieldConfig.primaryName) ||
        getFieldValue(record, fieldConfig.secondaryName),
      owner: getFieldValue(record, fieldConfig.owner),
      status: getFieldValue(record, fieldConfig.status),
      category: getFieldValue(record, fieldConfig.category) || fallbackCategory,
      description: getFieldValue(record, fieldConfig.description),
      sceneRef: getFieldValue(record, fieldConfig.sceneRef),
      mood: getFieldValue(record, fieldConfig.mood),
    }))
    .filter((row) => row.name || row.category);
}

function groupByScene(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const current = map.get(row.sceneName) ?? [];
    current.push(row);
    map.set(row.sceneName, current);
  });

  return [...map.entries()]
    .sort((left, right) => sceneNumberFromName(left[0]) - sceneNumberFromName(right[0]))
    .map(([sceneName, sceneRows]) => ({ sceneName, sceneRows }));
}

function countBuckets(rows) {
  return rows.reduce(
    (summary, row) => {
      const bucket = normalizeSceneStatus(row.sceneStatus);
      summary.total += 1;
      if (bucket === "done") summary.done += 1;
      if (bucket === "revision") summary.revision += 1;
      if (bucket === "pending") summary.pending += 1;
      return summary;
    },
    { total: 0, done: 0, revision: 0, pending: 0 },
  );
}

function buildAssignments(rows, ownerField, groupLabel) {
  const counters = new Map();

  rows.forEach((row) => {
    const owners = summarizeOwnerList(row[ownerField]);
    const bucket = normalizeSceneStatus(row.sceneStatus);

    owners.forEach((owner) => {
      const current = counters.get(owner) ?? {
        owner,
        group: groupLabel,
        assignedShots: 0,
        confirmed: 0,
        revision: 0,
        pending: 0,
      };

      current.assignedShots += 1;
      if (bucket === "done") current.confirmed += 1;
      if (bucket === "revision") current.revision += 1;
      if (bucket === "pending") current.pending += 1;
      counters.set(owner, current);
    });
  });

  return [...counters.values()];
}

function buildStoryboardScenes(sceneRows) {
  return groupByScene(sceneRows).map(({ sceneName, sceneRows: rows }) => {
    const counts = countBuckets(rows);
    const imageAssignments = buildAssignments(rows, "imageOwner", "图片制作");
    const videoAssignments = buildAssignments(rows, "videoOwner", "视频制作");
    const assignments = [...imageAssignments, ...videoAssignments];
    const sceneNumber = sceneNumberFromName(sceneName);

    return {
      sceneId: `scene-${String(sceneNumber).padStart(2, "0")}`,
      sceneName,
      sceneCode: sceneCodeFromName(sceneName),
      sceneNumber,
      sceneDescription: rows.find((row) => row.scriptContent)?.scriptContent || "暂无剧本描述",
      sceneType: rows.find((row) => row.level)?.level || "未标注",
      originalOwner: summarizeOwnerList(rows.find((row) => row.imageOwner)?.imageOwner).join(" / ") || "待分配",
      totalShots: counts.total,
      assignments,
      shots: [],
      confirmedShots: counts.done,
      revisionShots: counts.revision,
      pendingShots: counts.pending,
      deletedShots: 0,
      ownerSummary: assignments.map((item) => `${item.owner} ${item.assignedShots}项`).join(" / "),
      imageOwners: summarizeOwnerList(rows.map((row) => row.imageOwner).join(" / ")),
      videoOwners: summarizeOwnerList(rows.map((row) => row.videoOwner).join(" / ")),
      imageDoneAt: rows.map((row) => row.imageDoneAt).filter(Boolean)[0] || "",
      videoDoneAt: rows.map((row) => row.videoDoneAt).filter(Boolean)[0] || "",
    };
  });
}

function buildAssetGroups(rows, fallbackPriority) {
  const counters = new Map();

  rows.forEach((row) => {
    const key = row.category || "未分类";
    const current = counters.get(key) ?? {
      type: key,
      total: 0,
      done: 0,
      inProgress: 0,
      pending: 0,
      owners: new Set(),
      priority: fallbackPriority,
    };

    current.total += 1;
    const bucket = normalizeAssetStatus(row.status);
    if (bucket === "done") current.done += 1;
    if (bucket === "inProgress") current.inProgress += 1;
    if (bucket === "pending") current.pending += 1;
    summarizeOwnerList(row.owner).forEach((owner) => current.owners.add(owner));
    counters.set(key, current);
  });

  return [...counters.values()].map((item) => ({
    type: item.type,
    total: item.total,
    done: item.done,
    inProgress: item.inProgress,
    pending: item.pending,
    progress: item.total ? Number(((item.done / item.total) * 100).toFixed(1)) : 0,
    owner: [...item.owners].join(" / "),
    priority: item.priority,
    progressLabel: `${item.done}/${item.total}`,
  }));
}

function buildAssets(characterRows, sceneAssetRows, propRows) {
  const assets = [
    ...buildAssetGroups(characterRows, "P0"),
    ...buildAssetGroups(sceneAssetRows, "P1"),
    ...buildAssetGroups(propRows, "P1"),
  ];

  const summary = assets.reduce(
    (accumulator, asset) => {
      accumulator.total += asset.total;
      accumulator.done += asset.done;
      accumulator.inProgress += asset.inProgress;
      accumulator.pending += asset.pending;
      return accumulator;
    },
    { type: "合计", total: 0, done: 0, inProgress: 0, pending: 0, progress: 0, owner: "", priority: "" },
  );

  summary.progress = summary.total ? Number(((summary.done / summary.total) * 100).toFixed(1)) : 0;
  summary.progressLabel = `${summary.done}/${summary.total}`;

  return { assets, summary };
}

function buildAiTeam(sceneRows) {
  const counters = new Map();

  sceneRows.forEach((row) => {
    const bucket = normalizeSceneStatus(row.sceneStatus);
    [
      ...summarizeOwnerList(row.imageOwner).map((owner) => ({ owner, group: "图片制作" })),
      ...summarizeOwnerList(row.videoOwner).map((owner) => ({ owner, group: "视频制作" })),
    ].forEach(({ owner, group }) => {
      const current = counters.get(owner) ?? {
        name: owner,
        group,
        specialty: group,
        assignedShots: 0,
        done: 0,
        revision: 0,
        pending: 0,
        progress: 0,
        dailyTarget: 0,
        estimatedDays: 0,
        todayPriority: "P2",
        priorityNote: "",
        remark: group,
        sceneScope: "",
        remainingWorkload: 0,
        weeklyGoal: "",
        riskNote: "",
        todayP0: "",
        todayP1: "",
        sceneCoverage: [],
        todayTasks: [],
        queue: [],
      };

      current.assignedShots += 1;
      if (bucket === "done") current.done += 1;
      if (bucket === "revision") current.revision += 1;
      if (bucket === "pending") current.pending += 1;
      current.sceneCoverage.push({ sceneName: row.sceneName, shots: 1 });
      counters.set(owner, current);
    });
  });

  return [...counters.values()]
    .map((member) => {
      const sceneCountMap = new Map();
      member.sceneCoverage.forEach((item) => {
        sceneCountMap.set(item.sceneName, (sceneCountMap.get(item.sceneName) ?? 0) + 1);
      });
      const coverage = [...sceneCountMap.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([sceneName, shots]) => ({ sceneName, shots }));

      const remainingWorkload = member.revision + member.pending;
      const dailyTarget = Math.max(1, Math.ceil(Math.max(remainingWorkload, member.assignedShots) / 7));
      const topScene = coverage[0];

      return {
        ...member,
        progress: member.assignedShots ? Number(((member.done / member.assignedShots) * 100).toFixed(1)) : 0,
        dailyTarget,
        estimatedDays: dailyTarget ? Number((remainingWorkload / dailyTarget).toFixed(1)) : 0,
        todayPriority: member.revision > 0 ? "P0" : member.pending > 0 ? "P1" : "P2",
        priorityNote: topScene ? `${sceneCodeFromName(topScene.sceneName)} ${topScene.sceneName} × ${topScene.shots}` : "暂无",
        sceneScope: coverage.slice(0, 4).map((item) => `${item.sceneName} ${item.shots}项`).join(" / "),
        remainingWorkload,
        weeklyGoal: topScene ? `${topScene.sceneName} ${topScene.shots}项` : "暂无",
        riskNote: member.revision > 0 ? "返修项需要优先消化" : member.pending > dailyTarget * 4 ? "待制作积压较高" : "当前负载可控",
        todayP0: member.revision > 0 ? `优先处理 ${member.revision} 项返修` : "",
        todayP1: member.pending > 0 ? `推进 ${Math.min(member.pending, dailyTarget)} 项待制作` : "",
        sceneCoverage: coverage,
      };
    })
    .sort((left, right) => right.assignedShots - left.assignedShots || left.name.localeCompare(right.name, "zh-Hans-CN"));
}

function buildPriorities(aiTeam) {
  return aiTeam
    .map((member, index) => ({
      id: `priority-${index + 1}`,
      priority: member.todayPriority,
      owner: member.name,
      group: member.group,
      task: member.todayP0 || member.todayP1 || "维持当前节奏",
      scope: member.sceneScope || "暂无场次范围",
      shots: `${member.remainingWorkload}项`,
      type: member.revision > 0 ? "返修" : member.pending > 0 ? "待制作" : "已完成",
      estimate: `${member.dailyTarget}项/日`,
      basis: member.weeklyGoal || "暂无",
      status: member.revision > 0 ? "进行中" : member.pending > 0 ? "排期中" : "完成",
    }))
    .sort((left, right) => {
      const rank = { P0: 0, P1: 1, P2: 2 };
      return (rank[left.priority] ?? 9) - (rank[right.priority] ?? 9);
    })
    .slice(0, 10);
}

function buildRisks(sceneRows, assets, summary) {
  const sceneCounts = countBuckets(sceneRows);
  const noScriptRows = sceneRows.filter((row) => !row.scriptContent).length;
  const noVideoRows = sceneRows.filter((row) => !row.videoOwner).length;
  const noImageRows = sceneRows.filter((row) => !row.imageOwner).length;
  const risks = [];

  if (sceneCounts.revision > 0) {
    risks.push({
      id: "R01",
      category: "返修风险",
      description: `当前有 ${sceneCounts.revision} 条场次记录处于返修状态`,
      impact: "高",
      probability: "高",
      response: "优先清理新增返修，避免返修堆积拖慢后续视频制作",
      owner: "图片制作负责人",
      status: "关注中",
    });
  }

  if (sceneCounts.pending > 0) {
    risks.push({
      id: "R02",
      category: "制作积压",
      description: `当前有 ${sceneCounts.pending} 条场次记录仍待制作`,
      impact: sceneCounts.pending > 20 ? "高" : "中",
      probability: "中",
      response: "按照场次和负责人切分优先级，优先消化高难条目",
      owner: "执行团队",
      status: "关注中",
    });
  }

  if (summary.pending > 0) {
    risks.push({
      id: "R03",
      category: "资产不足",
      description: `资产仍有 ${summary.pending} 项未启动，可能影响后续场景与角色复用`,
      impact: "中",
      probability: "高",
      response: "优先补齐高复用角色、主场景与核心道具",
      owner: "资产负责人",
      status: "监控中",
    });
  }

  if (noScriptRows > 0) {
    risks.push({
      id: "R04",
      category: "脚本缺失",
      description: `${noScriptRows} 条定场图记录缺少对应剧本内容`,
      impact: "中",
      probability: "中",
      response: "补齐剧本描述，避免制作阶段理解偏差",
      owner: "分镜导演",
      status: "待观察",
    });
  }

  if (noImageRows > 0 || noVideoRows > 0) {
    risks.push({
      id: "R05",
      category: "分工缺口",
      description: `${noImageRows} 条缺图片分配，${noVideoRows} 条缺视频分配`,
      impact: "中",
      probability: "中",
      response: "补齐负责人映射，避免任务无人承接",
      owner: "项目统筹",
      status: "监控中",
    });
  }

  return risks;
}

function buildRuntimeDashboard(config, sceneRows, characterRows, sceneAssetRows, propRows) {
  const storyboardScenes = buildStoryboardScenes(sceneRows);
  const assetsInfo = buildAssets(characterRows, sceneAssetRows, propRows);
  const aiTeam = buildAiTeam(sceneRows);
  const priorities = buildPriorities(aiTeam);
  const sceneCounts = countBuckets(sceneRows);
  const risks = buildRisks(sceneRows, assetsInfo.assets, assetsInfo.summary);
  const completionRate = sceneCounts.total ? Number(((sceneCounts.done / sceneCounts.total) * 100).toFixed(1)) : 0;
  const syncedAt = new Date().toISOString();

  return {
    project: {
      name: config.projectName || "怪物",
      title: "怪物制片台",
      subtitle: "",
      episodeLabel: "第一集",
      episodeCount: 1,
      episodeDuration: "",
      dateRangeLabel: "",
      startDate: "",
      endDate: "",
      totalStoryboards: sceneCounts.total,
      completedStoryboards: sceneCounts.done,
      completionRate,
      assetTotal: assetsInfo.summary.total,
      assetCompleted: assetsInfo.summary.done,
      scriptProgress: "飞书定场图同步中",
      currentStage: "目前进度：第一集分镜制作",
      teamSize: aiTeam.length,
      coreTeamSize: 0,
      aiTeamSize: aiTeam.length,
      sceneCount: storyboardScenes.length,
      trackedShots: sceneCounts.total,
      priorityDate: "基于飞书实时同步",
      reassignSummary: {
        name: "合计",
        currentShots: sceneCounts.total,
        currentRatio: 0,
        reassignedShots: sceneCounts.total,
        ratio: 0,
        group: "",
        sceneSummary: "",
        confirmed: sceneCounts.done,
        revision: sceneCounts.revision,
        pending: sceneCounts.pending,
        dailyTarget: aiTeam.reduce((sum, member) => sum + member.dailyTarget, 0),
        estimatedDays: "",
        todayPriority: "",
        remark: "",
      },
      dailySummary: {
        assignedShots: sceneCounts.total,
        confirmed: sceneCounts.done,
        revision: sceneCounts.revision,
        pending: sceneCounts.pending,
        remaining: sceneCounts.revision + sceneCounts.pending,
      },
      priorityCount: priorities.length,
    },
    episodes: [],
    coreTeam: [],
    aiTeam,
    pipeline: [],
    risks,
    episodeSchedule: [],
    assets: assetsInfo.assets,
    assetSummary: assetsInfo.summary,
    priorities,
    storyboard: {
      trackedShots: sceneCounts.total,
      sceneCount: storyboardScenes.length,
      scenes: storyboardScenes,
      sceneRows,
    },
    sceneAssignments: storyboardScenes,
    reassignOverview: [],
    sourceMeta: {
      type: "feishu-scene-first",
      runtimeOnly: true,
      syncedAt,
      tableStats: {
        storyboardRows: sceneRows.length,
        characterAssets: characterRows.length,
        sceneAssets: sceneAssetRows.length,
        propAssets: propRows.length,
      },
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await loadLocalEnvFile();

  const config = await loadJson(args.configPath);
  const tenantAccessToken = await fetchTenantAccessToken();
  const appToken = config.baseId || getEnvOrThrow("FEISHU_BITABLE_APP_TOKEN");

  const storyboardRecords = await listRecords({
    appToken,
    tableId: config.tables.storyboardScenes.tableId,
    tenantAccessToken,
  });
  const characterRecords = await listRecords({
    appToken,
    tableId: config.tables.characterAssets.tableId,
    tenantAccessToken,
  });
  const sceneAssetRecords = await listRecords({
    appToken,
    tableId: config.tables.sceneAssets.tableId,
    tenantAccessToken,
  });
  const propRecords = await listRecords({
    appToken,
    tableId: config.tables.propAssets.tableId,
    tenantAccessToken,
  });

  const sceneRows = buildSceneRows(storyboardRecords, config.fieldCandidates.storyboardScenes);
  const characterRows = buildAssetRows(characterRecords, config.fieldCandidates.characterAssets, "人物资产");
  const sceneAssetRows = buildAssetRows(sceneAssetRecords, config.fieldCandidates.sceneAssets, "场景资产");
  const propRows = buildAssetRows(propRecords, config.fieldCandidates.propAssets, "道具资产");

  const runtimeData = buildRuntimeDashboard(config, sceneRows, characterRows, sceneAssetRows, propRows);
  await saveJson(args.outputPath || config.outputPath || DEFAULT_OUTPUT_PATH, runtimeData);

  console.log("Monster runtime dashboard exported");
  console.log(`- storyboard rows: ${sceneRows.length}`);
  console.log(`- character assets: ${characterRows.length}`);
  console.log(`- scene assets: ${sceneAssetRows.length}`);
  console.log(`- prop assets: ${propRows.length}`);
  console.log(`- output: ${resolveFromRoot(args.outputPath || config.outputPath || DEFAULT_OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
