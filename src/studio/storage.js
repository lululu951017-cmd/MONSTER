import { EPISODE_TITLES, STAGES, STORAGE_KEYS, getDefaultProgress } from "./config.js";

function createFallbackStorage() {
  return {
    async get(key) {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    async set(key, value) {
      window.localStorage.setItem(key, JSON.stringify(value));
      return value;
    },
    async remove(key) {
      window.localStorage.removeItem(key);
    },
  };
}

export function getStorageClient() {
  if (typeof window !== "undefined" && window.storage?.get && window.storage?.set) {
    return window.storage;
  }

  return createFallbackStorage();
}

function isoNow() {
  return new Date().toISOString();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function plusDays(baseDate, days) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function clampNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createStageRecord(stage, status = "pending", overrides = {}) {
  const now = isoNow();
  const progress = overrides.progress ?? getDefaultProgress(status);
  const outputCount =
    overrides.outputCount ??
    Math.max(0, Math.round(((stage.target ?? 1) * progress) / 100));

  return {
    status,
    progress,
    assignee: overrides.assignee ?? stage.assignee,
    updatedAt: overrides.updatedAt ?? now,
    startedAt: overrides.startedAt ?? (status === "pending" ? "" : now),
    reviewWaitingHours: overrides.reviewWaitingHours ?? (status === "review" ? 24 : 0),
    outputCount,
    version: overrides.version ?? (status === "pending" ? "" : "v1.0"),
    notes: overrides.notes ?? "",
    blockReason: overrides.blockReason ?? "",
  };
}

function buildEpisode(index, dueDate, stageStatuses = {}, stageOverrides = {}, summary = "") {
  const episode = index + 1;

  return {
    episode,
    title: EPISODE_TITLES[index] ?? `Episode ${String(episode).padStart(2, "0")}`,
    dueDate,
    summary,
    stages: Object.fromEntries(
      STAGES.map((stage) => {
        const status = stageStatuses[stage.key] ?? "pending";
        const overrides = stageOverrides[stage.key] ?? {};
        return [stage.key, createStageRecord(stage, status, overrides)];
      }),
    ),
  };
}

function createProject({ name, episodeCount, targetDeliveryDate }) {
  const now = isoNow();
  return {
    id: `${name.toLowerCase().replace(/\s+/g, "-")}-s1`,
    name,
    episodeCount,
    targetDeliveryDate,
    teamMembers: [],
    createdAt: now,
    updatedAt: now,
    lastSyncedAt: now,
    currentView: "overview",
    theme: "warm",
  };
}

function createEmptyEpisodes(episodeCount, startDate) {
  return Array.from({ length: episodeCount }, (_, index) =>
    buildEpisode(index, formatDate(plusDays(startDate, 3 + index * 3))),
  );
}

function createDemoEpisodes(episodeCount, startDate) {
  const stageData = [
    {
      statuses: {
        storyMainline: "done",
        episodeOutline: "done",
        episodeScript: "done",
        characterDesign: "done",
        sceneDesign: "done",
        episodeStoryboard: "done",
        comicToImage: "done",
        videoProduction: "done",
        editing: "review",
        postProduction: "active",
      },
      overrides: {
        editing: {
          reviewWaitingHours: 26,
          notes: "Final pacing sign-off is still waiting on the director.",
          progress: 91,
          outputCount: 2,
          version: "v2.3",
        },
        postProduction: {
          progress: 82,
          outputCount: 3,
          notes: "End-card package is almost done. Subtitle export is still pending.",
          version: "v1.8",
        },
      },
      summary: "This episode is in the finishing stretch and should close soon after final approval.",
    },
    {
      statuses: {
        storyMainline: "done",
        episodeOutline: "done",
        episodeScript: "done",
        characterDesign: "done",
        sceneDesign: "done",
        episodeStoryboard: "done",
        comicToImage: "active",
        videoProduction: "active",
        editing: "pending",
        postProduction: "pending",
      },
      overrides: {
        comicToImage: {
          progress: 71,
          outputCount: 28,
          notes: "Consistency pass completed. Batch rendering is underway.",
          version: "v3.0",
        },
        videoProduction: {
          progress: 44,
          outputCount: 3,
          notes: "Primary motion scenes are assembled, waiting on the remaining frames.",
          version: "v1.2",
        },
      },
      summary: "Image generation and compositing are running in parallel and should feed editing next.",
    },
    {
      statuses: {
        storyMainline: "done",
        episodeOutline: "done",
        episodeScript: "done",
        characterDesign: "done",
        sceneDesign: "active",
        episodeStoryboard: "review",
        comicToImage: "review",
        videoProduction: "pending",
        editing: "pending",
        postProduction: "pending",
      },
      overrides: {
        sceneDesign: {
          progress: 62,
          outputCount: 4,
          notes: "Night exterior variant still needs one cleanup pass.",
          version: "v2.0",
        },
        episodeStoryboard: {
          progress: 88,
          outputCount: 22,
          notes: "Storyboard package is with the director for review.",
          reviewWaitingHours: 30,
          version: "v1.4",
        },
        comicToImage: {
          progress: 84,
          outputCount: 30,
          notes: "Key scene image set has been in review for 78 hours.",
          reviewWaitingHours: 78,
          version: "v4.2",
        },
      },
      summary: "Long-running review on image output is the biggest bottleneck in the current pipeline.",
    },
    {
      statuses: {
        storyMainline: "done",
        episodeOutline: "done",
        episodeScript: "active",
        characterDesign: "active",
        sceneDesign: "active",
        episodeStoryboard: "pending",
        comicToImage: "pending",
        videoProduction: "pending",
        editing: "pending",
        postProduction: "pending",
      },
      overrides: {
        episodeScript: {
          progress: 63,
          outputCount: 8,
          notes: "The central conflict is stable, but the ending hook is still being tuned.",
          version: "v1.5",
        },
        characterDesign: {
          progress: 56,
          outputCount: 2,
          notes: "Wardrobe extension and prop variants are still in progress.",
          version: "v2.1",
        },
        sceneDesign: {
          progress: 52,
          outputCount: 3,
          notes: "Yesterday's output landed below the recent average.",
          version: "v1.1",
        },
      },
      summary: "Script and art are both moving, but storyboard work is not unlocked yet.",
    },
    {
      statuses: {
        storyMainline: "done",
        episodeOutline: "review",
        episodeScript: "pending",
        characterDesign: "active",
        sceneDesign: "pending",
        episodeStoryboard: "pending",
        comicToImage: "pending",
        videoProduction: "pending",
        editing: "pending",
        postProduction: "pending",
      },
      overrides: {
        episodeOutline: {
          progress: 86,
          outputCount: 1,
          notes: "Outline is waiting for the second review pass.",
          reviewWaitingHours: 18,
          version: "v1.0",
        },
        characterDesign: {
          progress: 58,
          outputCount: 2,
          notes: "Character work can use the current capacity window while script review is pending.",
          version: "v1.3",
        },
      },
      summary: "Art can move ahead for now, but script review still needs closure.",
    },
    {
      statuses: {
        storyMainline: "active",
        episodeOutline: "pending",
        episodeScript: "pending",
        characterDesign: "pending",
        sceneDesign: "pending",
        episodeStoryboard: "pending",
        comicToImage: "pending",
        videoProduction: "pending",
        editing: "pending",
        postProduction: "pending",
      },
      overrides: {
        storyMainline: {
          progress: 48,
          outputCount: 1,
          notes: "Director comments are still being folded back into the main arc.",
          reviewWaitingHours: 52,
          version: "v0.9",
        },
      },
      summary: "Story mainline is still stabilizing, so downstream work has not started.",
    },
    {
      statuses: {
        storyMainline: "active",
        episodeOutline: "pending",
        episodeScript: "pending",
        characterDesign: "pending",
        sceneDesign: "pending",
        episodeStoryboard: "pending",
        comicToImage: "pending",
        videoProduction: "pending",
        editing: "pending",
        postProduction: "pending",
      },
      overrides: {
        storyMainline: {
          progress: 34,
          outputCount: 1,
          notes: "At the current pace, the later scripts still need roughly two more weeks.",
          version: "v0.7",
        },
      },
      summary: "Script output is becoming a schedule pressure point for the back half of the season.",
    },
    {
      statuses: {},
      overrides: {},
      summary: "This episode is still waiting for upstream capacity to free up.",
    },
  ];

  return Array.from({ length: episodeCount }, (_, index) => {
    const sample = stageData[index] ?? { statuses: {}, overrides: {}, summary: "" };
    return buildEpisode(
      index,
      formatDate(plusDays(startDate, 3 + index * 3)),
      sample.statuses,
      sample.overrides,
      sample.summary,
    );
  });
}

function createDemoDailyLogs(episodeCount) {
  const daily = [
    {
      date: "2026-03-08",
      storyMainline: 1,
      episodeOutline: 1,
      episodeScript: 2,
      characterDesign: 2,
      sceneDesign: 3,
      episodeStoryboard: 5,
      comicToImage: 10,
      videoProduction: 1,
      editing: 0,
      postProduction: 0,
    },
    {
      date: "2026-03-09",
      storyMainline: 1,
      episodeOutline: 1,
      episodeScript: 1,
      characterDesign: 1,
      sceneDesign: 2,
      episodeStoryboard: 4,
      comicToImage: 16,
      videoProduction: 2,
      editing: 0,
      postProduction: 0,
    },
    {
      date: "2026-03-10",
      storyMainline: 0,
      episodeOutline: 1,
      episodeScript: 3,
      characterDesign: 1,
      sceneDesign: 1,
      episodeStoryboard: 6,
      comicToImage: 21,
      videoProduction: 1,
      editing: 1,
      postProduction: 0,
    },
    {
      date: "2026-03-11",
      storyMainline: 1,
      episodeOutline: 0,
      episodeScript: 2,
      characterDesign: 2,
      sceneDesign: 2,
      episodeStoryboard: 3,
      comicToImage: 14,
      videoProduction: 2,
      editing: 1,
      postProduction: 1,
    },
    {
      date: "2026-03-12",
      storyMainline: 0,
      episodeOutline: 1,
      episodeScript: 2,
      characterDesign: 2,
      sceneDesign: 2,
      episodeStoryboard: 7,
      comicToImage: 19,
      videoProduction: 2,
      editing: 2,
      postProduction: 0,
    },
    {
      date: "2026-03-13",
      storyMainline: 1,
      episodeOutline: 0,
      episodeScript: 1,
      characterDesign: 2,
      sceneDesign: 3,
      episodeStoryboard: 4,
      comicToImage: 24,
      videoProduction: 1,
      editing: 3,
      postProduction: 1,
    },
    {
      date: "2026-03-14",
      storyMainline: 1,
      episodeOutline: 1,
      episodeScript: 1,
      characterDesign: 2,
      sceneDesign: 2,
      episodeStoryboard: 4,
      comicToImage: 17,
      videoProduction: 2,
      editing: 1,
      postProduction: 2,
    },
  ];

  return daily.map((day, dayIndex) => ({
    date: day.date,
    entries: STAGES.flatMap((stage, stageIndex) => {
      const outputCount = day[stage.key] ?? 0;
      if (!outputCount) return [];

      return [
        {
          episode: 1 + ((dayIndex + stageIndex) % Math.max(1, episodeCount)),
          stage: stage.key,
          action: "output_logged",
          from: null,
          to: null,
          outputCount,
          note: `${stage.label} recorded ${outputCount} ${stage.unit}.`,
        },
      ];
    }),
  }));
}

function createDemoAssets() {
  return {
    characters: [
      {
        id: "lin-wu",
        name: "Lin Wu",
        status: "active",
        designVersion: "v2.1",
        prompt: "black coat, sharp eyes, urban sci-fi",
        notes: "Main character turnaround is approved.",
      },
      {
        id: "bai-yi",
        name: "Bai Yi",
        status: "review",
        designVersion: "v1.4",
        prompt: "reporter, tired look, handheld recorder",
        notes: "Costume detail review is still pending.",
      },
      {
        id: "monster-07",
        name: "Unit 07",
        status: "done",
        designVersion: "v3.0",
        prompt: "humanoid monster, silver veins, cold fog",
        notes: "Hero concept for key reveal scenes is locked.",
      },
    ],
    scenes: [
      {
        id: "harbor-17",
        name: "Harbor 17",
        status: "active",
        designVersion: "v1.7",
        prompt: "fog harbor, neon city, cold blue",
        notes: "Night variant is in the polish pass.",
      },
      {
        id: "archive-room",
        name: "Archive Room",
        status: "done",
        designVersion: "v1.2",
        prompt: "vault archive, steel shelves, dim light",
        notes: "Ready for direct reuse.",
      },
    ],
  };
}

export function createStudioState({ name, episodeCount, targetDeliveryDate, seedDemo = false }) {
  const project = createProject({ name, episodeCount, targetDeliveryDate });
  const startDate = new Date("2026-03-14T09:00:00Z");

  return {
    project,
    episodes: seedDemo
      ? createDemoEpisodes(episodeCount, startDate)
      : createEmptyEpisodes(episodeCount, startDate),
    dailyLogs: seedDemo ? createDemoDailyLogs(episodeCount) : [],
    assets: seedDemo ? createDemoAssets() : { characters: [], scenes: [] },
  };
}

async function loadSnapshotState() {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }

  try {
    const response = await fetch("/studio-sync/studio-state.json", {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const snapshot = await response.json();
    if (snapshot?.project && snapshot?.episodes && snapshot?.dailyLogs && snapshot?.assets) {
      return snapshot;
    }
  } catch {
    return null;
  }

  return null;
}

export async function loadStudioState() {
  const storage = getStorageClient();
  const [project, episodes, dailyLogs, assets] = await Promise.all([
    storage.get(STORAGE_KEYS.project),
    storage.get(STORAGE_KEYS.episodes),
    storage.get(STORAGE_KEYS.dailyLogs),
    storage.get(STORAGE_KEYS.assets),
  ]);

  if (!project && !episodes && !dailyLogs && !assets) {
    const snapshot = await loadSnapshotState();
    if (snapshot) {
      await saveStudioState(snapshot);
      return snapshot;
    }
  }

  return { project, episodes, dailyLogs, assets };
}

export async function saveStudioState(state) {
  const storage = getStorageClient();
  await Promise.all([
    storage.set(STORAGE_KEYS.project, state.project),
    storage.set(STORAGE_KEYS.episodes, state.episodes),
    storage.set(STORAGE_KEYS.dailyLogs, state.dailyLogs),
    storage.set(STORAGE_KEYS.assets, state.assets),
  ]);

  return state;
}

export async function initializeStudioState(options) {
  const state = createStudioState(options);
  await saveStudioState(state);
  return state;
}

export function appendDailyLog(dailyLogs, entry) {
  return upsertDailyLogEntry(dailyLogs, formatDate(new Date()), entry);
}

export function upsertDailyLogEntry(dailyLogs, date, entry) {
  const targetDate = date || formatDate(new Date());
  const existing = dailyLogs.find((item) => item.date === targetDate);

  if (existing) {
    return dailyLogs.map((item) =>
      item.date === targetDate ? { ...item, entries: [...item.entries, entry] } : item,
    );
  }

  return [...dailyLogs, { date: targetDate, entries: [entry] }];
}

export function buildStagePatch(previousStage, patch) {
  const nextStatus = patch.status ?? previousStage.status;
  const progress = getDefaultProgress(nextStatus, patch.progress ?? previousStage.progress);
  const now = isoNow();

  return {
    ...previousStage,
    ...patch,
    status: nextStatus,
    progress,
    updatedAt: now,
    startedAt: previousStage.startedAt || (nextStatus === "pending" ? "" : now),
    reviewWaitingHours:
      typeof patch.reviewWaitingHours === "number"
        ? clampNumber(patch.reviewWaitingHours)
        : nextStatus === "review"
          ? Math.max(previousStage.reviewWaitingHours, 1)
          : 0,
    outputCount:
      typeof patch.outputCount === "number"
        ? clampNumber(patch.outputCount)
        : previousStage.outputCount,
    version: patch.version ?? previousStage.version,
    notes: patch.notes ?? previousStage.notes,
    blockReason: patch.blockReason ?? previousStage.blockReason,
  };
}

export function touchProject(project, extra = {}) {
  return {
    ...project,
    ...extra,
    updatedAt: isoNow(),
  };
}

export function summarizeAssetCounts(assets) {
  return {
    characters: assets?.characters?.length ?? 0,
    scenes: assets?.scenes?.length ?? 0,
    activeCharacters:
      assets?.characters?.filter((item) => item.status === "active").length ?? 0,
    reviewScenes: assets?.scenes?.filter((item) => item.status === "review").length ?? 0,
  };
}
