import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { STAGES, STATUS_OPTIONS, STORAGE_KEYS, getStageMeta } from "../../src/studio/config.js";
import { createStudioState, touchProject } from "../../src/studio/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");
const DEFAULT_CONFIG_PATH = "scripts/feishu-sync/config.local.json";
const DEFAULT_EXAMPLE_PATH = "scripts/feishu-sync/config.example.json";
const DEFAULT_OUTPUT_DIR = "public/studio-sync";

function parseArgs(argv) {
  const args = {
    configPath: process.env.FEISHU_SYNC_CONFIG || DEFAULT_CONFIG_PATH,
    dryRun: false,
    validateOnly: false,
    listTablesOnly: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--config" && argv[index + 1]) {
      args.configPath = argv[index + 1];
      index += 1;
    } else if (current === "--dry-run") {
      args.dryRun = true;
    } else if (current === "--validate-config") {
      args.validateOnly = true;
    } else if (current === "--list-tables") {
      args.listTablesOnly = true;
    } else if (current === "--help" || current === "-h") {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Feishu sync skeleton

Usage:
  node scripts/feishu-sync/index.js --config scripts/feishu-sync/config.local.json

Options:
  --config <path>        Path to the sync config JSON.
  --dry-run              Fetch and normalize, but do not write snapshot files.
  --validate-config      Validate config shape only, no API calls.
  --list-tables          Print all Bitable tables available under the app token.
  --help                 Show this help message.
`);
}

function resolveFromRoot(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(ROOT_DIR, targetPath);
}

async function loadJsonFile(filePath) {
  const absolutePath = resolveFromRoot(filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw);
}

function unwrapValue(value) {
  if (Array.isArray(value)) {
    if (!value.length) return "";
    if (typeof value[0] === "object") {
      return value
        .map((item) => item?.text ?? item?.name ?? item?.value ?? item?.id ?? "")
        .filter(Boolean)
        .join(", ");
    }
    return value.join(", ");
  }

  if (value && typeof value === "object") {
    return value.text ?? value.name ?? value.value ?? value.id ?? JSON.stringify(value);
  }

  return value ?? "";
}

function getFieldValue(record, fieldName) {
  if (!record || !fieldName) return "";
  if (Array.isArray(fieldName)) {
    for (const candidate of fieldName) {
      const value = unwrapValue(record.fields?.[candidate]);
      if (String(value ?? "").trim()) return value;
    }
    return unwrapValue(record.fields?.[fieldName[0]]);
  }
  return unwrapValue(record.fields?.[fieldName]);
}

function toNumber(value, fallback = 0) {
  const raw = unwrapValue(value);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIso(value) {
  const raw = unwrapValue(value);
  if (!raw) return "";

  if (typeof raw === "number" || /^\d+$/.test(String(raw))) {
    const timestamp = Number(raw);
    const normalized = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toDateOnly(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : "";
}

function toDateKey(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : "";
}

function normalizeStatus(rawStatus, statusMap) {
  const raw = String(unwrapValue(rawStatus)).trim();
  if (!raw) return "";
  if (STATUS_OPTIONS.includes(raw)) return raw;
  return statusMap?.[raw] ?? "";
}

function getMappingTableAliases(mapping) {
  if (Array.isArray(mapping?.tables)) return mapping.tables;
  if (Array.isArray(mapping?.table)) return mapping.table;
  if (mapping?.table) return [mapping.table];
  return [];
}

function matchesRules(record, rules = []) {
  if (!rules.length) return true;

  return rules.every((rule) => {
    const rawValue = String(getFieldValue(record, rule.field)).trim();
    if (rule.equals !== undefined) return rawValue === String(rule.equals);
    if (rule.includes !== undefined) return rawValue.includes(String(rule.includes));
    if (Array.isArray(rule.oneOf)) return rule.oneOf.map(String).includes(rawValue);
    return true;
  });
}

function summarizeStatus(statuses) {
  if (!statuses.length) return "";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("review")) return "review";
  if (statuses.includes("active")) return "active";
  if (statuses.every((status) => status === "done")) return "done";
  if (statuses.includes("done")) return "active";
  return statuses[0];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function validateConfig(config) {
  const warnings = [];

  if (!config.project?.name) throw new Error("Config is missing project.name.");
  if (!config.project?.episodeCount) throw new Error("Config is missing project.episodeCount.");
  if (!config.feishu?.appIdEnv || !config.feishu?.appSecretEnv || !config.feishu?.appTokenEnv) {
    throw new Error("Config is missing Feishu environment variable bindings.");
  }

  if (!config.tables || typeof config.tables !== "object") {
    throw new Error("Config is missing tables.");
  }

  if (!config.stageMappings || typeof config.stageMappings !== "object") {
    throw new Error("Config is missing stageMappings.");
  }

  STAGES.forEach((stage) => {
    if (!config.stageMappings[stage.key]) {
      warnings.push(`Missing stage mapping for ${stage.key}.`);
      return;
    }

    const mapping = config.stageMappings[stage.key];
    const tableAliases = getMappingTableAliases(mapping);
    if (!tableAliases.length || tableAliases.some((alias) => !config.tables[alias])) {
      throw new Error(`Stage mapping ${stage.key} references an unknown table alias.`);
    }
  });

  Object.entries(config.tables).forEach(([alias, tableConfig]) => {
    if (!tableConfig.tableId && !tableConfig.tableName) {
      throw new Error(`Table "${alias}" must provide either tableId or tableName.`);
    }
  });

  return warnings;
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

function getEnvOrThrow(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchTenantAccessToken(syncConfig) {
  const baseUrl = syncConfig.feishu.baseUrl || "https://open.feishu.cn";
  const appId = getEnvOrThrow(syncConfig.feishu.appIdEnv);
  const appSecret = getEnvOrThrow(syncConfig.feishu.appSecretEnv);

  const data = await requestJson(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  if (!data.tenant_access_token) {
    throw new Error("Feishu response did not contain tenant_access_token.");
  }

  return data.tenant_access_token;
}

async function listTables({ baseUrl, tenantAccessToken, appToken, pageSize = 500 }) {
  const items = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    params.set("page_size", String(pageSize));
    if (pageToken) params.set("page_token", pageToken);

    const data = await requestJson(
      `${baseUrl}/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tenantAccessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    items.push(...(data.items ?? []));
    hasMore = Boolean(data.has_more);
    pageToken = data.page_token ?? "";
  }

  return items;
}

async function listRecords({ baseUrl, tenantAccessToken, appToken, tableId, viewId, pageSize = 500 }) {
  const items = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams();
    params.set("page_size", String(pageSize));
    if (pageToken) params.set("page_token", pageToken);
    if (viewId) params.set("view_id", viewId);

    const data = await requestJson(
      `${baseUrl}/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tenantAccessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    items.push(...(data.items ?? []));
    hasMore = Boolean(data.has_more);
    pageToken = data.page_token ?? "";
  }

  return items;
}

async function fetchTableData(syncConfig) {
  const baseUrl = syncConfig.feishu.baseUrl || "https://open.feishu.cn";
  const tenantAccessToken = await fetchTenantAccessToken(syncConfig);
  const appToken = getEnvOrThrow(syncConfig.feishu.appTokenEnv);
  const tables = await listTables({ baseUrl, tenantAccessToken, appToken });
  const tablesByName = new Map(tables.map((table) => [table.name, table.table_id]));
  const knownTableIds = new Set(tables.map((table) => table.table_id));

  const entries = await Promise.all(
    Object.entries(syncConfig.tables).map(async ([alias, tableConfig]) => {
      const resolvedFromName = tableConfig.tableName ? tablesByName.get(tableConfig.tableName) : "";
      const tableId =
        resolvedFromName || (tableConfig.tableId && knownTableIds.has(tableConfig.tableId) ? tableConfig.tableId : "");

      if (!tableId) {
        throw new Error(
          `Could not resolve table "${alias}". Check tableName "${tableConfig.tableName}" or tableId "${tableConfig.tableId ?? ""}".`,
        );
      }

      let records;
      try {
        records = await listRecords({
          baseUrl,
          tenantAccessToken,
          appToken,
          tableId,
          viewId: tableConfig.viewId,
          pageSize: tableConfig.pageSize ?? 500,
        });
      } catch (error) {
        throw new Error(
          `Failed to fetch table "${alias}" (${tableConfig.tableName ?? alias} / ${tableId}). ${error.message || error}`,
        );
      }

      return [
        alias,
        {
          tableId,
          tableName: tableConfig.tableName ?? tables.find((table) => table.table_id === tableId)?.name ?? alias,
          records,
        },
      ];
    }),
  );

  return Object.fromEntries(entries);
}

async function printRemoteTables(syncConfig) {
  const baseUrl = syncConfig.feishu.baseUrl || "https://open.feishu.cn";
  const tenantAccessToken = await fetchTenantAccessToken(syncConfig);
  const appToken = getEnvOrThrow(syncConfig.feishu.appTokenEnv);
  const tables = await listTables({ baseUrl, tenantAccessToken, appToken });

  console.log("Available Bitable tables");
  tables.forEach((table) => {
    console.log(`- ${table.name} / ${table.table_id}`);
  });
}

function buildBaseState(syncConfig) {
  return createStudioState({
    name: syncConfig.project.name,
    episodeCount: syncConfig.project.episodeCount,
    targetDeliveryDate: syncConfig.project.targetDeliveryDate,
    seedDemo: false,
  });
}

function applyOverviewRecords(state, syncConfig, tableRecords) {
  const overviewConfig = syncConfig.overviewFields;
  if (!overviewConfig) return;

  const records = tableRecords[overviewConfig.table]?.records ?? [];
  records.forEach((record) => {
    const episodeNumber = toNumber(getFieldValue(record, overviewConfig.episode), 0);
    if (!episodeNumber) return;

    const episode = state.episodes.find((item) => item.episode === episodeNumber);
    if (!episode) return;

    const title = getFieldValue(record, overviewConfig.title);
    const dueDate = toDateOnly(getFieldValue(record, overviewConfig.dueDate));
    const summary = getFieldValue(record, overviewConfig.summary);

    if (title) episode.title = title;
    if (dueDate) episode.dueDate = dueDate;
    if (summary) episode.summary = summary;
  });
}

function normalizeStageRow(record, stageKey, mapping, statusMap) {
  const fields = mapping.fields ?? {};
  const episode = toNumber(getFieldValue(record, fields.episode), mapping.defaultEpisode ?? 0);
  if (!episode) return null;

  const updatedAt = toIso(getFieldValue(record, fields.updatedAt));
  const startedAt = toIso(getFieldValue(record, fields.startedAt));
  const normalizedStatus = normalizeStatus(getFieldValue(record, fields.status), statusMap);
  const completionValue = getFieldValue(record, mapping.completionField);
  const completed = Boolean(String(completionValue ?? "").trim()) || normalizedStatus === "done";
  const active = Boolean(
    normalizedStatus ||
      (mapping.activityFields ?? []).some((fieldName) => String(getFieldValue(record, fieldName)).trim()),
  );
  const outputCount =
    mapping.outputMode === "countRecords"
      ? 1
      : mapping.outputMode === "countCompletedRows"
        ? completed
          ? 1
          : 0
        : toNumber(getFieldValue(record, fields.outputCount), 0);

  return {
    episode,
    stageKey,
    data: {
      status: normalizedStatus,
      progress: toNumber(getFieldValue(record, fields.progress), 0),
      outputCount,
      outputTarget: mapping.outputTargetMode === "countRecords" ? 1 : 0,
      assignee: getFieldValue(record, fields.assignee),
      updatedAt,
      startedAt,
      reviewWaitingHours: toNumber(getFieldValue(record, fields.reviewWaitingHours), 0),
      version: getFieldValue(record, fields.version),
      notes: getFieldValue(record, fields.notes),
      blockReason: getFieldValue(record, fields.blockReason),
      __completed: completed,
      __active: active,
    },
    logEntry:
      updatedAt && outputCount > 0
        ? {
            date: toDateKey(updatedAt),
            entry: {
              episode,
              stage: stageKey,
              action: "output_logged",
              from: null,
              to: null,
              outputCount,
              note: getFieldValue(record, fields.notes) || `${getStageMeta(stageKey)?.label} synced from Feishu`,
            },
          }
        : null,
  };
}

function mergeStageRows(rows) {
  const statuses = rows.map((row) => row.data.status).filter(Boolean);
  const mergedStatus = summarizeStatus(statuses);
  const latestUpdatedAt = rows
    .map((row) => row.data.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const earliestStartedAt = rows
    .map((row) => row.data.startedAt)
    .filter(Boolean)
    .sort()
    .at(0);
  const progressValues = rows.map((row) => row.data.progress).filter((value) => value > 0);
  const completedRows = rows.filter((row) => row.data.__completed).length;
  const activeRows = rows.filter((row) => row.data.__active).length;
  const outputTarget = rows.reduce((sum, row) => sum + (row.data.outputTarget || 0), 0);
  const outputCount = rows.reduce((sum, row) => sum + row.data.outputCount, 0);
  const reviewWaitingHours = Math.max(...rows.map((row) => row.data.reviewWaitingHours), 0);
  const assignee = uniqueStrings(rows.map((row) => row.data.assignee)).join(", ");
  const version = uniqueStrings(rows.map((row) => row.data.version)).at(-1) ?? "";
  const notes = uniqueStrings(rows.map((row) => row.data.notes)).slice(-3).join(" | ");
  const blockReason = uniqueStrings(rows.map((row) => row.data.blockReason)).join(" | ");

  const ratioProgress = outputTarget ? Math.round((completedRows / outputTarget) * 100) : 0;
  const inferredStatus =
    statuses.includes("blocked")
      ? "blocked"
      : statuses.includes("review")
        ? "review"
        : outputTarget && completedRows >= outputTarget
          ? "done"
          : activeRows > 0
            ? "active"
            : mergedStatus;

  return {
    status: inferredStatus,
    progress: progressValues.length
      ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
      : ratioProgress,
    outputCount,
    outputTarget,
    assignee,
    updatedAt: latestUpdatedAt || "",
    startedAt: earliestStartedAt || "",
    reviewWaitingHours,
    version,
    notes,
    blockReason,
  };
}

function applyStageMappings(state, syncConfig, tableRecords) {
  const grouped = new Map();
  const logEntries = [];

  Object.entries(syncConfig.stageMappings).forEach(([stageKey, mapping]) => {
    const records = getMappingTableAliases(mapping).flatMap((alias) =>
      (tableRecords[alias]?.records ?? []).filter((record) => matchesRules(record, mapping.recordMatch)),
    );

    records.forEach((record) => {
      const normalized = normalizeStageRow(record, stageKey, mapping, syncConfig.statusMap);
      if (!normalized) return;

      const compositeKey = `${normalized.episode}:${stageKey}`;
      const current = grouped.get(compositeKey) ?? [];
      current.push(normalized);
      grouped.set(compositeKey, current);

      if (normalized.logEntry) {
        logEntries.push(normalized.logEntry);
      }
    });
  });

  grouped.forEach((rows, compositeKey) => {
    const [episodeNumberText, stageKey] = compositeKey.split(":");
    const episodeNumber = Number(episodeNumberText);
    const episode = state.episodes.find((item) => item.episode === episodeNumber);
    if (!episode) return;

    const merged = mergeStageRows(rows);
    episode.stages[stageKey] = {
      ...episode.stages[stageKey],
      status: merged.status || episode.stages[stageKey].status,
      progress: merged.progress || episode.stages[stageKey].progress,
      outputCount: merged.outputCount,
      outputTarget: merged.outputTarget || episode.stages[stageKey].outputTarget || 0,
      assignee: merged.assignee || episode.stages[stageKey].assignee,
      updatedAt: merged.updatedAt || episode.stages[stageKey].updatedAt,
      startedAt: merged.startedAt || episode.stages[stageKey].startedAt,
      reviewWaitingHours: merged.reviewWaitingHours,
      version: merged.version || episode.stages[stageKey].version,
      notes: merged.notes || episode.stages[stageKey].notes,
      blockReason: merged.blockReason || "",
    };
  });

  return logEntries;
}

function applyReviewOverlay(state, syncConfig, tableRecords) {
  const reviewConfig = syncConfig.reviewOverlay;
  if (!reviewConfig) return;

  const records = tableRecords[reviewConfig.table]?.records ?? [];
  records.forEach((record) => {
    const fields = reviewConfig.fields ?? {};
    const episodeNumber = toNumber(getFieldValue(record, fields.episode), 0);
    const stageName = getFieldValue(record, fields.stageName);
    const stageKey = reviewConfig.stageNameMap?.[stageName];
    if (!episodeNumber || !stageKey) return;

    const episode = state.episodes.find((item) => item.episode === episodeNumber);
    if (!episode) return;

    const stage = episode.stages[stageKey];
    const waitingHours = toNumber(getFieldValue(record, fields.waitingHours), stage.reviewWaitingHours);
    const reviewStatus = getFieldValue(record, fields.reviewStatus);
    const overlayStatus = normalizeStatus(reviewStatus, syncConfig.statusMap);
    const note = getFieldValue(record, fields.note);

    stage.reviewWaitingHours = waitingHours;
    if (overlayStatus === "review" || overlayStatus === "blocked") {
      stage.status = overlayStatus;
    }
    if (note) {
      stage.notes = uniqueStrings([stage.notes, note]).join(" | ");
    }
  });
}

function buildAssets(syncConfig, tableRecords) {
  const assetConfig = syncConfig.assetMapping;
  if (!assetConfig) return { characters: [], scenes: [] };

  const fields = assetConfig.fields ?? {};
  const characterTables = assetConfig.characterTables ?? (assetConfig.table ? [assetConfig.table] : []);
  const sceneTables = assetConfig.sceneTables ?? [];
  const propTables = assetConfig.propTables ?? [];

  function normalizeAssetRecord(record, fallbackPrefix) {
    const normalized = {
      id: getFieldValue(record, fields.id) || `${fallbackPrefix}-${record.record_id}`,
      name: getFieldValue(record, fields.name),
      status: normalizeStatus(getFieldValue(record, fields.status), syncConfig.statusMap) || "pending",
      designVersion: getFieldValue(record, fields.designVersion),
      prompt: getFieldValue(record, fields.prompt),
      notes: getFieldValue(record, fields.notes),
    };

    return normalized.name ? normalized : null;
  }

  const characters = characterTables.flatMap((alias) =>
    (tableRecords[alias]?.records ?? [])
      .map((record) => normalizeAssetRecord(record, alias))
      .filter(Boolean),
  );

  const scenes = [...sceneTables, ...propTables].flatMap((alias) =>
    (tableRecords[alias]?.records ?? [])
      .map((record) => normalizeAssetRecord(record, alias))
      .filter(Boolean),
  );

  return { characters, scenes };
}

function buildDailyLogs(logEntries) {
  const grouped = new Map();

  logEntries.forEach((item) => {
    if (!item?.date) return;
    const current = grouped.get(item.date) ?? [];
    current.push(item.entry);
    grouped.set(item.date, current);
  });

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => ({ date, entries }));
}

async function writeSnapshot(state, outputDir) {
  const outputPath = resolveFromRoot(outputDir || DEFAULT_OUTPUT_DIR);
  await fs.mkdir(outputPath, { recursive: true });

  const manifest = {
    syncedAt: new Date().toISOString(),
    keys: STORAGE_KEYS,
    counts: {
      episodes: state.episodes.length,
      dailyLogs: state.dailyLogs.length,
      characters: state.assets.characters.length,
      scenes: state.assets.scenes.length,
    },
  };

  const writes = [
    [STORAGE_KEYS.project, state.project],
    [STORAGE_KEYS.episodes, state.episodes],
    [STORAGE_KEYS.dailyLogs, state.dailyLogs],
    [STORAGE_KEYS.assets, state.assets],
    ["studio-state", state],
    ["manifest", manifest],
  ].map(([name, value]) =>
    fs.writeFile(path.join(outputPath, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, "utf8"),
  );

  await Promise.all(writes);
}

function printSummary(syncConfig, state, tableRecords) {
  console.log("Config and sync summary");
  console.log(`Project: ${syncConfig.project.name}`);
  console.log(`Episodes: ${state.episodes.length}`);
  console.log(`Tables fetched: ${Object.keys(tableRecords).length}`);
  Object.entries(tableRecords).forEach(([alias, payload]) => {
    console.log(`- ${alias}: ${payload.records.length} records (${payload.tableName} / ${payload.tableId})`);
  });
  console.log(`Daily logs: ${state.dailyLogs.length}`);
  console.log(`Characters: ${state.assets.characters.length}`);
  console.log(`Scenes: ${state.assets.scenes.length}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  let config;
  try {
    config = await loadJsonFile(args.configPath);
  } catch (error) {
    if (args.configPath === DEFAULT_CONFIG_PATH) {
      throw new Error(
        `Could not read ${DEFAULT_CONFIG_PATH}. Copy ${DEFAULT_EXAMPLE_PATH} to config.local.json first.`,
      );
    }
    throw error;
  }

  const warnings = validateConfig(config);
  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

  if (args.validateOnly) {
    console.log(`Config is valid: ${resolveFromRoot(args.configPath)}`);
    console.log(`Output directory: ${resolveFromRoot(config.outputDir || DEFAULT_OUTPUT_DIR)}`);
    console.log(`Mapped stages: ${Object.keys(config.stageMappings).length}/${STAGES.length}`);
    return;
  }

  if (args.listTablesOnly) {
    await printRemoteTables(config);
    return;
  }

  const tableRecords = await fetchTableData(config);
  const state = buildBaseState(config);

  applyOverviewRecords(state, config, tableRecords);
  const logEntries = applyStageMappings(state, config, tableRecords);
  applyReviewOverlay(state, config, tableRecords);
  state.assets = buildAssets(config, tableRecords);
  state.dailyLogs = buildDailyLogs(logEntries);
  state.project = touchProject(state.project, {});

  if (args.dryRun) {
    printSummary(config, state, tableRecords);
    console.log("Dry run only, no files were written.");
    return;
  }

  await writeSnapshot(state, config.outputDir);
  printSummary(config, state, tableRecords);
  console.log(`Snapshot written to ${resolveFromRoot(config.outputDir || DEFAULT_OUTPUT_DIR)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
