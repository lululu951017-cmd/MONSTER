import { STAGE_DEPENDENCIES, STAGES, TRACKS, getStageMeta } from "./config.js";

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getTrackPercent(episodes, trackKey) {
  const track = TRACKS.find((item) => item.key === trackKey);
  if (!track) return 0;

  const stages = episodes.flatMap((episode) =>
    track.stageKeys.map((stageKey) => episode.stages[stageKey]),
  );
  const done = stages.filter((stage) => stage?.status === "done").length;
  return stages.length ? Math.round((done / stages.length) * 100) : 0;
}

export function isStageReady(episode, stageKey) {
  const dependencies = STAGE_DEPENDENCIES[stageKey] ?? [];
  return dependencies.every((dependencyKey) => episode.stages[dependencyKey]?.status === "done");
}

export function getOverallProgress(episodes) {
  const allStages = episodes.flatMap((episode) => Object.values(episode.stages));
  const total = allStages.length;
  const done = allStages.filter((stage) => stage.status === "done").length;

  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

export function getTrackProgress(episodes) {
  return TRACKS.map((track) => {
    const trackStages = episodes.flatMap((episode) =>
      track.stageKeys.map((stageKey) => episode.stages[stageKey]),
    );
    const total = trackStages.length;
    const done = trackStages.filter((stage) => stage.status === "done").length;

    return {
      ...track,
      total,
      done,
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  });
}

export function getStageDistribution(episodes) {
  return STAGES.map((stage) => {
    const counts = { done: 0, active: 0, review: 0, blocked: 0, pending: 0 };

    episodes.forEach((episode) => {
      const status = episode.stages[stage.key]?.status ?? "pending";
      counts[status] += 1;
    });

    return {
      name: stage.shortLabel,
      ...counts,
    };
  });
}

export function getDailyTrendData(dailyLogs) {
  return dailyLogs.slice(-7).map((day) => {
    const base = { date: day.date.slice(5) };

    STAGES.forEach((stage) => {
      base[stage.key] = day.entries
        .filter((entry) => entry.stage === stage.key)
        .reduce((sum, entry) => sum + safeNumber(entry.outputCount), 0);
    });

    return base;
  });
}

export function getReadyItems(episodes) {
  return episodes.flatMap((episode) =>
    STAGES.filter(
      (stage) =>
        episode.stages[stage.key]?.status === "pending" && isStageReady(episode, stage.key),
    ).map((stage) => ({
      episode: episode.episode,
      title: episode.title,
      stageKey: stage.key,
      stageLabel: stage.label,
    })),
  );
}

export function getBalanceGap(episodes) {
  const scriptPercent = getTrackPercent(episodes, "script");
  const artPercent = getTrackPercent(episodes, "art");

  return {
    scriptPercent,
    artPercent,
    gapEpisodes: Math.round(Math.abs(scriptPercent - artPercent) / 20),
  };
}

export function getAlerts(project, episodes, dailyLogs) {
  const alerts = [];

  episodes.forEach((episode) => {
    STAGES.forEach((stage) => {
      const stageData = episode.stages[stage.key];
      if (!stageData) return;

      if (stageData.status === "blocked") {
        alerts.push({
          id: `${episode.episode}-${stage.key}-blocked`,
          level: "critical",
          type: "blocked",
          episode: episode.episode,
          stageKey: stage.key,
          title: `EP${String(episode.episode).padStart(2, "0")} ${stage.label} is blocked`,
          message:
            stageData.blockReason ||
            `${stage.label} is blocked and should be cleared today before more downstream work stalls.`,
          rule: "Blocked work -> critical",
        });
      }

      if (stageData.status === "review" && stageData.reviewWaitingHours > 72) {
        alerts.push({
          id: `${episode.episode}-${stage.key}-review-critical`,
          level: "critical",
          type: "review-timeout",
          episode: episode.episode,
          stageKey: stage.key,
          title: `EP${String(episode.episode).padStart(2, "0")} ${stage.label} review overdue`,
          message: `${stage.label} has waited ${stageData.reviewWaitingHours} hours in review. Escalate it today.`,
          rule: "Review > 72h -> critical",
        });
      } else if (stageData.status === "review" && stageData.reviewWaitingHours > 48) {
        alerts.push({
          id: `${episode.episode}-${stage.key}-review-warning`,
          level: "warning",
          type: "review-timeout",
          episode: episode.episode,
          stageKey: stage.key,
          title: `EP${String(episode.episode).padStart(2, "0")} ${stage.label} review waiting`,
          message: `${stage.label} has waited ${stageData.reviewWaitingHours} hours in review and should be scheduled today.`,
          rule: "Review > 48h -> warning",
        });
      }

      if (stageData.status === "pending" && isStageReady(episode, stage.key)) {
        alerts.push({
          id: `${episode.episode}-${stage.key}-ready`,
          level: "info",
          type: "ready",
          episode: episode.episode,
          stageKey: stage.key,
          title: `EP${String(episode.episode).padStart(2, "0")} ${stage.label} can start`,
          message: `All prerequisites are complete, so ${stage.label} can be pulled into today's work.`,
          rule: "Upstream done, downstream not started -> info",
        });
      }
    });

    const incompleteStage = Object.values(episode.stages).some((stage) => stage.status !== "done");
    if (incompleteStage && episode.dueDate) {
      const dueDate = new Date(episode.dueDate);
      const now = new Date();
      const hoursLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60));
      if (hoursLeft > 0 && hoursLeft <= 24) {
        alerts.push({
          id: `${episode.episode}-due-soon`,
          level: "info",
          type: "due-soon",
          episode: episode.episode,
          stageKey: null,
          title: `EP${String(episode.episode).padStart(2, "0")} deadline is within 24h`,
          message: `This episode is due in about ${hoursLeft} hours and still has unfinished pipeline steps.`,
          rule: "Deadline within 24h -> info",
        });
      }
    }
  });

  const dailyTrend = getDailyTrendData(dailyLogs);
  const latestDay = dailyTrend[dailyTrend.length - 1];

  if (latestDay) {
    STAGES.forEach((stage) => {
      const history = dailyTrend.slice(0, -1).map((day) => day[stage.key] ?? 0);
      const avg = average(history);
      const latest = latestDay[stage.key] ?? 0;

      if (avg > 0 && latest < avg * 0.7) {
        alerts.push({
          id: `trend-${stage.key}`,
          level: "warning",
          type: "output-drop",
          episode: null,
          stageKey: stage.key,
          title: `${stage.label} output dropped`,
          message: `Today's ${stage.label} output is ${latest} ${stage.unit}, below 70% of the 7-day average of ${avg.toFixed(1)}.`,
          rule: "Today < 70% of 7-day average -> warning",
        });
      }
    });
  }

  const balance = getBalanceGap(episodes);
  if (balance.gapEpisodes > 2) {
    alerts.push({
      id: "track-balance-gap",
      level: "warning",
      type: "track-gap",
      episode: null,
      stageKey: null,
      title: "Script and art lines are out of balance",
      message: `The script line and art line are drifting by about ${balance.gapEpisodes} episodes. Rebalance staffing before the gap widens.`,
      rule: "Script vs art > 2 episodes -> warning",
    });
  }

  const todayOutput = dailyTrend[dailyTrend.length - 1];
  const averageDailyOutput = average(
    dailyTrend.map((day) =>
      STAGES.reduce((sum, stage) => sum + safeNumber(day[stage.key]), 0),
    ),
  );
  const totalRemainingUnits = episodes.reduce(
    (episodeSum, episode) =>
      episodeSum +
      STAGES.reduce((stageSum, stage) => {
        const stageData = episode.stages[stage.key];
        const target = safeNumber(stageData?.outputTarget) || stage.target || 1;
        return stageSum + Math.max(0, target - safeNumber(stageData.outputCount));
      }, 0),
    0,
  );

  if (project?.targetDeliveryDate && todayOutput) {
    const today = new Date();
    const targetDate = new Date(project.targetDeliveryDate);
    const remainingDays = Math.max(1, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));

    if (averageDailyOutput > 0 && totalRemainingUnits / averageDailyOutput > remainingDays) {
      alerts.push({
        id: "schedule-risk",
        level: "warning",
        type: "schedule-risk",
        episode: null,
        stageKey: null,
        title: "Delivery risk is rising",
        message: `Remaining work is projected to take ${(totalRemainingUnits / averageDailyOutput).toFixed(1)} days, but only ${remainingDays} days remain.`,
        rule: "Remaining work / average output > remaining days -> warning",
      });
    }
  }

  const readyItems = getReadyItems(episodes);
  if (readyItems.length) {
    const mostLaggingTrack =
      getTrackProgress(episodes).sort((left, right) => left.percent - right.percent)[0]?.key ?? "";

    const pullForward = readyItems.find(
      (item) => getStageMeta(item.stageKey)?.track === mostLaggingTrack,
    );

    if (pullForward) {
      alerts.push({
        id: `capacity-${pullForward.episode}-${pullForward.stageKey}`,
        level: "info",
        type: "capacity-window",
        episode: pullForward.episode,
        stageKey: pullForward.stageKey,
        title: `Capacity window on ${getStageMeta(pullForward.stageKey)?.label}`,
        message: `The ${mostLaggingTrack} track has a ready item on EP${String(pullForward.episode).padStart(2, "0")}. This is a good candidate to pull forward.`,
        rule: "Parallel capacity window -> info",
      });
    }
  }

  return alerts.sort((left, right) => {
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    return levelOrder[left.level] - levelOrder[right.level];
  });
}

export function getSuggestions(project, episodes, dailyLogs, alerts) {
  const suggestions = [];
  const readyItems = getReadyItems(episodes);
  const criticalAlerts = alerts.filter((alert) => alert.level === "critical");
  const warningAlerts = alerts.filter((alert) => alert.level === "warning");

  criticalAlerts.slice(0, 2).forEach((alert) => {
    suggestions.push({
      id: `${alert.id}-suggestion`,
      tag: "Risk",
      title: alert.title,
      text: `${alert.message} Clear this first so downstream work can move again.`,
    });
  });

  warningAlerts
    .filter((alert) => alert.type === "output-drop" || alert.type === "schedule-risk")
    .slice(0, 2)
    .forEach((alert) => {
      suggestions.push({
        id: `${alert.id}-warning`,
        tag: "Efficiency",
        title: alert.title,
        text: `${alert.message} Replan today's batch so the next downstream dependency stays protected.`,
      });
    });

  readyItems.slice(0, 3).forEach((item) => {
    suggestions.push({
      id: `ready-${item.episode}-${item.stageKey}`,
      tag: "Schedule",
      title: `Start ${item.stageLabel} on EP${String(item.episode).padStart(2, "0")}`,
      text: `The prerequisites are complete, so this stage is safe to pull forward today.`,
    });
  });

  const balance = getBalanceGap(episodes);
  if (balance.gapEpisodes > 2) {
    suggestions.push({
      id: "track-balance",
      tag: "Quality",
      title: "Rebalance the script and art lines",
      text: `The script and art lines are drifting by about ${balance.gapEpisodes} episodes. Shift capacity before more downstream waits build up.`,
    });
  }

  const overall = getOverallProgress(episodes);
  if (!suggestions.length) {
    suggestions.push({
      id: "steady-state",
      tag: "Efficiency",
      title: "Pipeline is stable",
      text: `Overall progress is ${overall.percent}%. Keep the current rhythm and use today's capacity on newly unlocked work.`,
    });
  }

  if (project?.targetDeliveryDate) {
    const targetDate = new Date(project.targetDeliveryDate);
    const today = new Date();
    const remainingDays = Math.max(1, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
    suggestions.push({
      id: "delivery-clock",
      tag: "Schedule",
      title: "Watch the delivery clock",
      text: `${remainingDays} days remain until delivery. Use this as the pacing baseline for today's decisions.`,
    });
  }

  if (dailyLogs.length) {
    const trend = getDailyTrendData(dailyLogs);
    const latest = trend[trend.length - 1];
    const total = latest
      ? STAGES.reduce((sum, stage) => sum + safeNumber(latest[stage.key]), 0)
      : 0;

    suggestions.push({
      id: "latest-output",
      tag: "Efficiency",
      title: "Anchor decisions on today's output",
      text: `Today's logged output is ${total} total units across the pipeline. Use that to decide whether to push more work or clear review first.`,
    });
  }

  return suggestions.slice(0, 6);
}

export function getHealthStatus(alerts) {
  if (alerts.some((alert) => alert.level === "critical")) return "Warning";
  if (alerts.some((alert) => alert.level === "warning")) return "Watch";
  return "Good";
}

export function getEpisodeSummary(episode) {
  const stages = Object.entries(episode.stages);
  const current = stages.find(([, data]) => data.status === "active" || data.status === "review");
  const doneCount = stages.filter(([, data]) => data.status === "done").length;

  return {
    doneCount,
    currentStageKey: current?.[0] ?? STAGES[0].key,
    currentStageLabel: getStageMeta(current?.[0] ?? STAGES[0].key)?.label ?? "Pending",
  };
}

export function getEpisodeAlerts(alerts, episodeNumber) {
  return alerts.filter((alert) => alert.episode === episodeNumber);
}

export function getTodayOutput(dailyLogs) {
  const dailyTrend = getDailyTrendData(dailyLogs);
  const latest = dailyTrend[dailyTrend.length - 1];
  if (!latest) return { total: 0, data: null };

  const total = STAGES.reduce((sum, stage) => sum + safeNumber(latest[stage.key]), 0);
  return { total, data: latest };
}

export function getReminderCounts(alerts) {
  return {
    critical: alerts.filter((alert) => alert.level === "critical").length,
    warning: alerts.filter((alert) => alert.level === "warning").length,
    info: alerts.filter((alert) => alert.level === "info").length,
  };
}
