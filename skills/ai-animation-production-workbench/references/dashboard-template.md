# Dashboard Template

Read this file only when rendering or refreshing the workbench artifact.

## UI Requirements

- Use React JSX artifact rendering
- Use `window.storage` for persistence
- Use a warm palette centered on `#E8793A`, `#F59E0B`, and `#FFFBF5`
- Use rounded cards, soft shadows, and responsive layout
- Use `recharts` for charts

## Required Regions

1. Header
   - project name
   - overall progress
   - 4 track progress bars
2. Core matrix
   - `episodeCount x 10` heat matrix
   - color by status
   - clickable cell or episode
3. Charts
   - 7-day output trend
   - stage completion chart
4. Side panels
   - reminders
   - smart suggestions
5. Interaction
   - switch views: overview, episode, alerts
   - support inline updates where practical

## Data Contract

Expect these loaded values:

```js
const project = await window.storage.get("studio-project");
const episodes = await window.storage.get("studio-episodes");
const dailyLogs = await window.storage.get("studio-daily-logs");
const assets = await window.storage.get("studio-assets");
```

## Minimal Artifact Skeleton

```jsx
import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const STAGES = [
  "storyMainline",
  "episodeOutline",
  "episodeScript",
  "characterDesign",
  "sceneDesign",
  "episodeStoryboard",
  "comicToImage",
  "videoProduction",
  "editing",
  "postProduction",
];

export default function ProductionWorkbench() {
  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [assets, setAssets] = useState(null);
  const [view, setView] = useState("overview");
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  useEffect(() => {
    async function load() {
      const [p, e, logs, a] = await Promise.all([
        window.storage.get("studio-project"),
        window.storage.get("studio-episodes"),
        window.storage.get("studio-daily-logs"),
        window.storage.get("studio-assets"),
      ]);
      setProject(p);
      setEpisodes(e ?? []);
      setDailyLogs(logs ?? []);
      setAssets(a);
    }
    load();
  }, []);

  const metrics = useMemo(() => {
    const allStages = episodes.flatMap((episode) => Object.values(episode.stages));
    const done = allStages.filter((stage) => stage.status === "done").length;
    return {
      done,
      total: allStages.length,
      overallPct: allStages.length ? Math.round((done / allStages.length) * 100) : 0,
    };
  }, [episodes]);

  async function updateStage(episodeNumber, stageKey, patch) {
    const nextEpisodes = episodes.map((episode) =>
      episode.episode !== episodeNumber
        ? episode
        : {
            ...episode,
            stages: {
              ...episode.stages,
              [stageKey]: { ...episode.stages[stageKey], ...patch },
            },
          },
    );

    await window.storage.set("studio-episodes", nextEpisodes);
    setEpisodes(nextEpisodes);
  }

  if (!project) return <div>Loading...</div>;

  return <div>{/* render header, matrix, charts, reminders, and suggestions */}</div>;
}
```

## Implementation Notes

- Build reminders and suggestions from current derived data, not hard-coded text
- Keep matrix status colors consistent across all views
- Refresh derived metrics after every storage write
- For batch updates, stage edits may open a small form or drawer; keep the default interaction fast
- Prefer a single source of truth in storage and derive charts from stored data
