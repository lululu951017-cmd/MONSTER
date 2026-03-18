# Suggestion Rules

## Global Health Checks

- Overall progress = `done stage count / total stage count`
- Track progress = `done stages in track / total stages in track`
- Bottleneck = any `blocked` stage, or any `review` stage waiting too long
- Two-line balance warning = script line and art line differ by more than 2 episodes

## Reminder Priority

### Critical

- any blocked stage that prevents downstream work
- any review waiting more than 72 hours
- any delivery calculation where remaining work / recent output exceeds remaining days

### Warning

- review waiting more than 48 hours
- stage output today is lower than 7-day average by 30 percent or more
- script line vs art line balance gap is greater than 2 episodes

### Info

- upstream finished and downstream can start
- deadline within 24 hours
- temporary capacity window appears on a parallel line

## Suggested Today-Task Order

1. unblock blocked work
2. clear overdue reviews
3. start newly unlocked downstream work
4. pull forward parallel work if capacity exists
5. polish non-critical quality items last

## Dependency Rules

Core dependency chain:

`storyMainline -> episodeOutline -> episodeScript`

`storyMainline -> characterDesign -> sceneDesign`

`episodeScript + characterDesign + sceneDesign -> episodeStoryboard -> comicToImage -> videoProduction -> editing -> postProduction`

Use these checks:

- `episodeStoryboard` can start only when `episodeScript`, `characterDesign`, and `sceneDesign` are all `done`
- `comicToImage` can start only when `episodeStoryboard` is `done`
- `videoProduction` can start only when `comicToImage` is `done`
- `editing` can start only when `videoProduction` is `done`
- `postProduction` can start only when `editing` is `done`
- `characterDesign` and `sceneDesign` may run in parallel after `episodeOutline` is `done`

## Trend Rules

Use the most recent 7 days of logs whenever possible.

- Output drop rule: if today is 30 percent or more below 7-day average, raise efficiency warning
- Review timeout rule: 48 hours = warning, 72 hours = critical
- Delivery risk rule: if `remaining workload / 7-day average output > remaining days`, raise schedule risk
- Parallel opportunity rule: if one line has idle capacity and prerequisites are satisfied, recommend starting the next ready item

## Smart Suggestion Style

Keep suggestions short, operational, and specific:

- identify the episode and stage
- explain why it matters now
- recommend one next action

Good pattern:

`EP03 comicToImage review has waited 78h. Escalate the review today so video production can start before the weekend.`

## Advisor Output Shape

Use this structure when the user asks for guidance:

```text
Project health: [Good / Watch / Warning]

Urgent:
- ...

Today:
- ...

Ready to start:
- ...

Trend insight:
- ...
```

## Report Templates

### Daily Report

```markdown
# [Project Name] Daily Production Report · [Date]

## Today at a Glance
- Overall progress: X% (+N%)
- Today output: [counts by stage]
- State changes: [major transitions]

## Track Status
### Script line
### Art line
### Integration line
### Post line

## Risks and Blockers
## Tomorrow Plan
## Notes
```

### Weekly Report

```markdown
# [Project Name] Weekly Production Report · [Week]

## Executive Summary
## Progress Delta
## Track-by-Track Review
## Risks, Bottlenecks, and Escalations
## Next Week Priorities
## Decisions Needed
```
