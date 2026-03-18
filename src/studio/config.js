export const STORAGE_KEYS = {
  project: "studio-project",
  episodes: "studio-episodes",
  dailyLogs: "studio-daily-logs",
  assets: "studio-assets",
};

export const STATUS_META = {
  pending: {
    label: "Pending",
    color: "#8f95a3",
    bg: "rgba(143,149,163,0.12)",
    progress: 0,
  },
  active: {
    label: "Active",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.16)",
    progress: 52,
  },
  review: {
    label: "In Review",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.16)",
    progress: 84,
  },
  blocked: {
    label: "Blocked",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.16)",
    progress: 38,
  },
  done: {
    label: "Done",
    color: "#10b981",
    bg: "rgba(16,185,129,0.14)",
    progress: 100,
  },
};

export const STATUS_OPTIONS = ["pending", "active", "review", "blocked", "done"];

export const STAGES = [
  {
    key: "storyMainline",
    label: "Story Mainline",
    shortLabel: "Mainline",
    icon: "ML",
    track: "script",
    table: "Table 2 - Script Management",
    unit: "doc",
    target: 1,
    assignee: "Lead Writer",
  },
  {
    key: "episodeOutline",
    label: "Episode Outline",
    shortLabel: "Outline",
    icon: "OL",
    track: "script",
    table: "Table 2 - Script Management",
    unit: "doc",
    target: 1,
    assignee: "Episode Architect",
  },
  {
    key: "episodeScript",
    label: "Episode Script",
    shortLabel: "Script",
    icon: "SC",
    track: "script",
    table: "Table 2 - Script Management",
    unit: "scene",
    target: 12,
    assignee: "Writer",
  },
  {
    key: "characterDesign",
    label: "Character Design",
    shortLabel: "Character",
    icon: "CH",
    track: "art",
    table: "Table 3 - Art Assets",
    unit: "character",
    target: 4,
    assignee: "Character Lead",
  },
  {
    key: "sceneDesign",
    label: "Scene Design",
    shortLabel: "Scene",
    icon: "BG",
    track: "art",
    table: "Table 3 - Art Assets",
    unit: "scene",
    target: 6,
    assignee: "Concept Artist",
  },
  {
    key: "episodeStoryboard",
    label: "Episode Storyboard",
    shortLabel: "Storyboard",
    icon: "SB",
    track: "integration",
    table: "Table 4 - Storyboard Management",
    unit: "shot",
    target: 24,
    assignee: "Storyboard Director",
  },
  {
    key: "comicToImage",
    label: "Comic to Image",
    shortLabel: "Image",
    icon: "IM",
    track: "integration",
    table: "Table 5 - AI Image Tasks",
    unit: "frame",
    target: 36,
    assignee: "AI Image Lead",
  },
  {
    key: "videoProduction",
    label: "Video Production",
    shortLabel: "Video",
    icon: "VD",
    track: "integration",
    table: "Table 6 - Video Production",
    unit: "clip",
    target: 8,
    assignee: "Compositing Director",
  },
  {
    key: "editing",
    label: "Editing",
    shortLabel: "Edit",
    icon: "ED",
    track: "post",
    table: "Table 6 - Video Production",
    unit: "cut",
    target: 3,
    assignee: "Editor",
  },
  {
    key: "postProduction",
    label: "Post Production",
    shortLabel: "Post",
    icon: "PT",
    track: "post",
    table: "Table 6 - Video Production",
    unit: "package",
    target: 4,
    assignee: "Post Supervisor",
  },
];

export const TRACKS = [
  {
    key: "script",
    label: "Script Line",
    stageKeys: ["storyMainline", "episodeOutline", "episodeScript"],
  },
  {
    key: "art",
    label: "Art Line",
    stageKeys: ["characterDesign", "sceneDesign"],
  },
  {
    key: "integration",
    label: "Integration Line",
    stageKeys: ["episodeStoryboard", "comicToImage", "videoProduction"],
  },
  {
    key: "post",
    label: "Post Line",
    stageKeys: ["editing", "postProduction"],
  },
];

export const STAGE_DEPENDENCIES = {
  storyMainline: [],
  episodeOutline: ["storyMainline"],
  episodeScript: ["episodeOutline"],
  characterDesign: ["episodeOutline"],
  sceneDesign: ["episodeOutline"],
  episodeStoryboard: ["episodeScript", "characterDesign", "sceneDesign"],
  comicToImage: ["episodeStoryboard"],
  videoProduction: ["comicToImage"],
  editing: ["videoProduction"],
  postProduction: ["editing"],
};

export const EPISODE_TITLES = [
  "Harbor Echo",
  "Black Box Signal",
  "Code 07",
  "The City Runs Cold",
  "Archive Fog",
  "Blank Witness",
  "Mirror Fall",
  "The Name of the Monster",
];

export const VIEW_LABELS = {
  overview: "Overview",
  episodes: "Episodes",
  alerts: "Alerts",
};

export function getStageMeta(stageKey) {
  return STAGES.find((stage) => stage.key === stageKey) ?? null;
}

export function getDefaultProgress(status, currentProgress = 0) {
  if (typeof currentProgress === "number" && currentProgress > 0) {
    if (status === "done") return 100;
    if (status === "pending") return 0;
    return currentProgress;
  }

  return STATUS_META[status]?.progress ?? 0;
}
