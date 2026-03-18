# Data Schema

## Storage Keys

- `studio-project`: project metadata and dashboard preferences
- `studio-episodes`: episode-level stage data
- `studio-daily-logs`: append-only production log
- `studio-assets`: character and scene archives

## Stage Keys

Use these exact stage keys in order:

1. `storyMainline`
2. `episodeOutline`
3. `episodeScript`
4. `characterDesign`
5. `sceneDesign`
6. `episodeStoryboard`
7. `comicToImage`
8. `videoProduction`
9. `editing`
10. `postProduction`

## Track Mapping

- Script line: `storyMainline`, `episodeOutline`, `episodeScript`
- Art line: `characterDesign`, `sceneDesign`
- Integration line: `episodeStoryboard`, `comicToImage`, `videoProduction`
- Post line: `editing`, `postProduction`

## Status Values

- `pending`
- `active`
- `review`
- `blocked`
- `done`

## Project Shape

```json
{
  "id": "monster-s1",
  "name": "MONSTER",
  "episodeCount": 8,
  "targetDeliveryDate": "2026-04-30",
  "createdAt": "2026-03-14T09:00:00Z",
  "updatedAt": "2026-03-14T09:00:00Z",
  "currentView": "overview",
  "theme": "warm"
}
```

## Episode Shape

```json
[
  {
    "episode": 1,
    "title": "Episode 1",
    "dueDate": "2026-03-20",
    "summary": "",
    "stages": {
      "storyMainline": {
        "status": "done",
        "progress": 100,
        "assignee": "writer-a",
        "updatedAt": "2026-03-12T10:00:00Z",
        "reviewWaitingHours": 0,
        "outputCount": 1,
        "version": "v1.0",
        "notes": "",
        "blockReason": ""
      }
    }
  }
]
```

Repeat the same stage object shape for all 10 stages. Recommended stage fields:

- `status`
- `progress`
- `assignee`
- `updatedAt`
- `startedAt`
- `reviewWaitingHours`
- `outputCount`
- `version`
- `notes`
- `blockReason`

## Daily Log Shape

```json
[
  {
    "date": "2026-03-14",
    "entries": [
      {
        "episode": 3,
        "stage": "episodeStoryboard",
        "action": "status_changed",
        "from": "active",
        "to": "done",
        "outputCount": 18,
        "note": "Storyboard locked for review"
      }
    ]
  }
]
```

## Asset Shape

```json
{
  "characters": [
    {
      "id": "lin-wu",
      "name": "Lin Wu",
      "status": "active",
      "designVersion": "v2",
      "prompt": "",
      "notes": ""
    }
  ],
  "scenes": [
    {
      "id": "harbor-17",
      "name": "Harbor 17",
      "status": "review",
      "designVersion": "v1",
      "prompt": "",
      "notes": ""
    }
  ]
}
```

## Initialization Defaults

When the user is new:

1. create `studio-project`
2. create one episode object per episode number
3. initialize every stage as `pending`, `progress: 0`, and blank notes
4. initialize `studio-daily-logs` as an empty array
5. initialize `studio-assets` with empty `characters` and `scenes` arrays

Set `storyMainline` to `active` only if the user explicitly says work has already started.
