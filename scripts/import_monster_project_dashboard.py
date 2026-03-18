from __future__ import annotations

import json
import re
from collections import Counter, defaultdict, deque
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
OUTPUT_PATH = ROOT / "src" / "data" / "monsterProjectDashboard.json"

PROJECT_HINT = "怪物_项目分镜排期表"
STORYBOARD_HINT = "怪物_分镜头脚本_表格"
REASSIGN_HINT = "怪物_镜头重分配排期表"

EPISODE_COLORS = ["#111111", "#ff9f1c", "#ef5d5d", "#4c9aff", "#7f56d9", "#22a06b"]

NAME_OVERRIDES = {
    "赵凯": "何诗萌",
    "周航": "陈一伊",
    "孙晨": "曾可迪",
    "徐宁": "张叶湘",
    "徐可": "张叶湘",
    "张磊": "小米",
    "李伟": "李豆豆",
    "王涛": "王序云",
}

SCENE_OWNER_OVERRIDES = {
    "第一场": {
        "owner": "张叶湘",
        "group": "修整组",
        "assignmentNote": "已完成/修整组执行",
        "sceneType": "修整组执行",
    }
}

ASSET_OVERRIDES = {
    "主角角色": {"total": 10, "done": 4, "inProgress": 2, "pending": 4, "owner": "李豆豆 / 何磊", "priority": "P0"},
    "配角角色": {"total": 40, "done": 6, "inProgress": 7, "pending": 27, "owner": "李豆豆 / 陈一伊", "priority": "P0"},
    "怪物设计": {"total": 40, "done": 5, "inProgress": 6, "pending": 29, "owner": "李豆豆", "priority": "P0"},
    "场景设计": {"total": 50, "done": 7, "inProgress": 8, "pending": 35, "owner": "李豆豆", "priority": "P1"},
    "主要场景": {"type": "场景设计", "total": 50, "done": 7, "inProgress": 8, "pending": 35, "owner": "李豆豆", "priority": "P1"},
    "道具设计": {"total": 10, "done": 2, "inProgress": 3, "pending": 5, "owner": "吴昊", "priority": "P1"},
    "道具": {"type": "道具设计", "total": 10, "done": 2, "inProgress": 3, "pending": 5, "owner": "吴昊", "priority": "P1"},
    "3D环境 / 材质贴图": {"total": 10, "done": 1, "inProgress": 4, "pending": 5, "owner": "高铭", "priority": "P2"},
    "材质贴图": {"type": "3D环境 / 材质贴图", "total": 10, "done": 1, "inProgress": 4, "pending": 5, "owner": "高铭", "priority": "P2"},
    "3D环境": {"type": "模型资产", "total": 10, "done": 2, "inProgress": 2, "pending": 6, "owner": "王序云", "priority": "P2"},
    "模型资产": {"total": 10, "done": 2, "inProgress": 2, "pending": 6, "owner": "王序云", "priority": "P2"},
    "特效资产": {"type": "LORA风格", "total": 10, "done": 3, "inProgress": 4, "pending": 3, "owner": "小敏 / 马骁", "priority": "P1"},
    "LORA风格": {"total": 10, "done": 3, "inProgress": 4, "pending": 3, "owner": "小敏 / 马骁", "priority": "P1"},
}

REPAIR_OWNER = "张叶湘"

TEAM_PLAN_PROFILES = {
    "小敏": {
        "group": "文戏组",
        "preferredTypes": {"普通分镜", "关键帧"},
        "sceneKeywords": ("文戏", "对话", "情绪", "叙事"),
    },
    "刘鹏": {
        "group": "文戏组",
        "preferredTypes": {"普通分镜", "关键帧"},
        "sceneKeywords": ("文戏", "对话", "情绪", "叙事"),
    },
    "何诗萌": {
        "group": "文戏组",
        "preferredTypes": {"普通分镜", "关键帧"},
        "sceneKeywords": ("文戏", "对话", "情绪", "叙事"),
    },
    "高铭": {
        "group": "动作组",
        "preferredTypes": {"动作镜", "普通分镜"},
        "sceneKeywords": ("动作", "运动", "冲突", "悬疑", "异变"),
    },
    "陈一伊": {
        "group": "动作组",
        "preferredTypes": {"动作镜", "普通分镜"},
        "sceneKeywords": ("动作", "运动", "冲突", "悬疑", "异变"),
    },
    "吴昊": {
        "group": "动作组",
        "preferredTypes": {"动作镜", "普通分镜"},
        "sceneKeywords": ("动作", "运动", "冲突", "悬疑", "异变"),
    },
    "曾可迪": {
        "group": "氛围组",
        "preferredTypes": {"关键帧", "普通分镜"},
        "sceneKeywords": ("空镜", "氛围", "群像", "异变", "怪物"),
    },
    "马骁": {
        "group": "氛围组",
        "preferredTypes": {"关键帧", "普通分镜"},
        "sceneKeywords": ("空镜", "氛围", "群像", "异变", "怪物"),
    },
    "何磊": {
        "group": "氛围组",
        "preferredTypes": {"关键帧", "普通分镜"},
        "sceneKeywords": ("空镜", "氛围", "群像", "异变", "怪物"),
    },
    "张叶湘": {
        "group": "修整组",
        "preferredTypes": {"修镜", "关键帧"},
        "sceneKeywords": ("修整",),
    },
}


def find_latest_workbook(name_hint: str) -> Path:
    candidates = [
        path
        for path in DOWNLOADS.glob("*.xlsx")
        if name_hint in path.name and not path.name.startswith("~$")
    ]
    if not candidates:
        raise FileNotFoundError(f"未在 {DOWNLOADS} 找到包含 {name_hint!r} 的 Excel 文件")
    return sorted(candidates, key=lambda item: item.stat().st_mtime, reverse=True)[0]


def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def text(value) -> str:
    value = clean(value)
    return str(value).strip() if value != "" else ""


def rename_people(value) -> str:
    result = text(value)
    for old_name, new_name in NAME_OVERRIDES.items():
        result = result.replace(old_name, new_name)
    return result


def as_int(value) -> int:
    value = clean(value)
    if value == "":
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return round(value)
    match = re.search(r"-?\d+(?:\.\d+)?", str(value))
    if not match:
        return 0
    return round(float(match.group(0)))


def as_float(value) -> float:
    value = clean(value)
    if value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace("%", ""))
    except ValueError:
        return 0.0


def as_percent(value) -> float:
    number = as_float(value)
    return round(number * 100, 1) if number <= 1 else round(number, 1)


def parse_scene_number(scene_name: str) -> int:
    numerals = {
        "一": 1,
        "二": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "十": 10,
        "十一": 11,
        "十二": 12,
        "十三": 13,
        "十四": 14,
        "十五": 15,
        "十六": 16,
        "十七": 17,
        "十八": 18,
        "十九": 19,
        "二十": 20,
    }
    match = re.search(r"第(.+?)场", scene_name)
    if not match:
        return 0
    return numerals.get(match.group(1), 0)


def scene_code(scene_name: str) -> str:
    number = parse_scene_number(scene_name)
    return f"S{number:02d}" if number else "S00"


def scene_sort_key(scene_name: str) -> tuple[int, str]:
    return (parse_scene_number(scene_name), scene_name)


def map_priority_label(label: str) -> str:
    if not label:
        return "P2"
    return re.search(r"P\d", label).group(0) if re.search(r"P\d", label) else "P2"


def map_status_label(label: str) -> str:
    mapping = {
        "已确认": "完成",
        "需修改": "修改中",
        "待制作": "未开始",
        "已删除": "已删除",
        "待开始": "未开始",
        "准备中": "未开始",
        "进行中": "修改中",
    }
    return mapping.get(label, label or "未开始")


def infer_shot_type(group_name: str, scene_type: str, status: str) -> str:
    if status == "已删除":
        return "修镜"
    if "动作" in scene_type or "动作" in group_name:
        return "动作镜"
    if "空镜" in scene_type or "氛围" in scene_type or "氛围" in group_name:
        return "关键帧"
    if status == "需修改":
        return "修镜"
    return "普通分镜"


def extract_issue_tags(note: str, scene_type: str, status: str) -> list[str]:
    combined = f"{note} {scene_type}"
    tags = []
    if "色调" in combined or "风格" in combined:
        tags.append("色调")
    if any(word in combined for word in ["人物", "表情", "角色", "动作"]):
        tags.append("人物")
    if any(word in combined for word in ["场景", "背景", "环境", "县城", "群山", "怪物"]):
        tags.append("场景")
    if any(word in combined for word in ["精细", "准确", "一致", "光影"]):
        tags.append("准确度")
    if status == "需修改" and "准确度" not in tags:
        tags.append("准确度")
    if not tags:
        tags.append("准确度")
    return list(dict.fromkeys(tags))[:3]


def load_project_overview(sheet) -> tuple[dict, list[dict]]:
    project = {
        "name": text(sheet["B5"].value),
        "title": "怪物制片台",
        "subtitle": "6集 AI 动画项目制片总览",
        "episodeLabel": text(sheet["E5"].value),
        "episodeCount": as_int(sheet["E5"].value),
        "episodeDuration": text(sheet["B6"].value),
        "dateRangeLabel": text(sheet["E6"].value),
        "startDate": "2025-02-10",
        "endDate": "2025-10-17",
        "totalStoryboards": as_int(sheet["B7"].value),
        "completedStoryboards": as_int(sheet["E7"].value),
        "completionRate": as_percent(sheet["B8"].value),
        "assetTotal": as_int(sheet["E8"].value),
        "assetCompleted": as_int(sheet["B9"].value),
        "scriptProgress": text(sheet["E9"].value),
        "currentStage": text(sheet["B10"].value),
        "teamSize": as_int(sheet["E10"].value),
        "coreTeamSize": 8,
        "aiTeamSize": 10,
        "sceneCount": 19,
    }

    episodes = []
    for row in sheet.iter_rows(min_row=14, max_row=19, values_only=True):
        episode_name = text(row[0])
        if not episode_name or episode_name == "合计":
            continue
        index = len(episodes)
        episodes.append(
            {
                "episode": episode_name,
                "episodeCode": f"EP{index + 1:02d}",
                "color": EPISODE_COLORS[index],
                "totalShots": as_int(row[1]),
                "done": as_int(row[2]),
                "revision": as_int(row[3]),
                "pending": as_int(row[4]),
                "progress": as_percent(row[5]),
                "lead": text(row[6]),
                "lead": rename_people(row[6]),
                "support": rename_people(row[7]),
                "stage": text(row[8]),
                "startDate": text(row[9]),
                "endDate": text(row[10]),
                "status": text(row[11]),
            }
        )
    return project, episodes


def load_core_team(sheet) -> list[dict]:
    rows = []
    for row in sheet.iter_rows(min_row=6, max_row=13, values_only=True):
        if not row[0]:
            continue
        rows.append(
            {
                "name": rename_people(row[0]),
                "role": text(row[1]),
                "responsibility": rename_people(row[2]),
                "currentTask": rename_people(row[3]),
                "priority": text(row[4]),
                "status": text(row[5]),
            }
        )
    return rows


def load_pipeline(sheet) -> list[dict]:
    rows = []
    for index, row in enumerate(sheet.iter_rows(min_row=4, values_only=True), start=1):
        if not row[0]:
            continue
        rows.append(
            {
                "id": f"stage-{index:02d}",
                "stage": text(row[0]),
                "owner": rename_people(row[1]),
                "startDate": text(row[2]),
                "endDate": text(row[3]),
                "durationDays": as_int(row[4]),
                "progress": as_percent(row[5]),
                "status": text(row[6]),
                "dependency": rename_people(row[16]) if len(row) > 16 else "",
                "note": rename_people(row[17]) if len(row) > 17 else "",
            }
        )
    return rows


def load_risks(sheet) -> list[dict]:
    rows = []
    for row in sheet.iter_rows(min_row=4, values_only=True):
        if not row[0]:
            continue
        rows.append(
            {
                "id": text(row[0]),
                "category": text(row[1]),
                "description": rename_people(row[2]),
                "impact": text(row[3]),
                "probability": text(row[4]),
                "response": rename_people(row[5]),
                "owner": rename_people(row[6]),
                "status": text(row[7]),
            }
        )
    return rows


def load_episode_schedule(sheet) -> list[dict]:
    rows = []
    for row in sheet.iter_rows(min_row=4, values_only=True):
        if not row[0]:
            continue
        rows.append(
            {
                "episode": text(row[0]),
                "stage": text(row[1]),
                "owner": rename_people(row[2]),
                "startDate": text(row[3]),
                "endDate": text(row[4]),
                "days": as_int(row[5]),
                "shots": text(row[6]),
                "dailyOutput": text(row[7]),
                "status": text(row[8]),
                "priority": text(row[9]),
                "dependency": rename_people(row[10]),
                "note": rename_people(row[11]),
            }
        )
    return rows


def load_assets(sheet) -> tuple[list[dict], dict]:
    rows = []
    summary = {}
    for row in sheet.iter_rows(min_row=4, values_only=True):
        if not row[0]:
            continue
        item = {
            "type": text(row[0]),
            "total": as_int(row[1]),
            "done": as_int(row[2]),
            "inProgress": as_int(row[3]),
            "pending": as_int(row[4]),
            "progress": as_percent(row[5]),
            "owner": rename_people(row[6]),
            "priority": text(row[7]),
        }
        if item["type"] == "合计":
            summary = item
        else:
            rows.append(item)
    return rows, summary


def load_storyboard_source(sheet) -> dict:
    scene_rows = defaultdict(deque)
    flat_rows = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        scene_name = text(row[0])
        shot_id = text(row[1])
        if not scene_name or not shot_id:
            continue
        item = {
            "sceneName": scene_name,
            "shotId": shot_id,
            "sceneCode": scene_code(scene_name),
            "description": text(row[3]),
            "dialogue": text(row[4]),
            "oldOwner": rename_people(row[5]),
            "referenceImage": text(row[6]),
            "status": text(row[7]),
            "finalImage": text(row[8]),
            "directorNote": rename_people(row[10]),
        }
        scene_rows[scene_name].append(item)
        flat_rows.append(item)
    return {"sceneRows": scene_rows, "flatRows": flat_rows}


def load_reassign_overview(sheet) -> tuple[list[dict], dict]:
    rows = []
    summary = {}
    for row in sheet.iter_rows(min_row=6, values_only=True):
        creator = text(row[0])
        if not creator:
            continue
        item = {
            "name": rename_people(creator),
            "currentShots": as_int(row[1]),
            "currentRatio": as_percent(row[2]),
            "reassignedShots": as_int(row[3]),
            "ratio": as_percent(row[4]),
            "group": text(row[5]),
            "sceneSummary": rename_people(row[6]),
            "confirmed": as_int(row[7]),
            "revision": as_int(row[8]),
            "pending": as_int(row[9]),
            "dailyTarget": as_int(row[10]),
            "estimatedDays": text(row[11]),
            "todayPriority": rename_people(row[12]),
            "remark": rename_people(row[13]),
        }
        if creator == "合计":
            summary = item
            continue
        rows.append(item)
    return rows, summary


def load_scene_assignments(sheet) -> dict:
    scenes = {}
    current_scene = None
    for row in sheet.iter_rows(min_row=6, values_only=True):
        scene_name = text(row[0])
        if scene_name:
            current_scene = scene_name
            scenes[current_scene] = {
                "sceneName": scene_name,
                "sceneCode": scene_code(scene_name),
                "sceneNumber": parse_scene_number(scene_name),
                "sceneDescription": rename_people(row[1]),
                "totalShots": as_int(row[2]),
                "originalOwner": rename_people(row[3]),
                "sceneType": text(row[7]),
                "assignments": [],
            }

        if not current_scene or not text(row[4]):
            continue

        scenes[current_scene]["assignments"].append(
            {
                "owner": rename_people(row[4]),
                "group": text(row[6]),
                "assignedShots": as_int(row[5]),
                "confirmed": as_int(row[8]),
                "revision": as_int(row[9]),
                "pending": as_int(row[10]),
                "note": rename_people(row[11]),
            }
        )
    return scenes


def load_daily_workloads(sheet) -> tuple[list[dict], dict]:
    members = []
    summary = {}
    for row in sheet.iter_rows(min_row=6, values_only=True):
        name = text(row[0])
        if not name:
            continue
        if name.startswith("📌") or name == "指标":
            break
        if name == "合计":
            summary = {
                "assignedShots": as_int(row[3]),
                "confirmed": as_int(row[4]),
                "revision": as_int(row[5]),
                "pending": as_int(row[6]),
                "remaining": as_int(row[7]),
            }
            continue
        members.append(
            {
                "name": rename_people(name),
                "group": text(row[1]),
                "sceneScope": text(row[2]),
                "assignedShots": as_int(row[3]),
                "confirmed": as_int(row[4]),
                "revision": as_int(row[5]),
                "pending": as_int(row[6]),
                "remainingWorkload": as_int(row[7]),
                "dailyTarget": as_int(row[8]),
                "estimatedDays": round(as_float(row[9]), 1),
                "todayP0": rename_people(row[10]),
                "todayP1": rename_people(row[11]),
                "weeklyGoal": rename_people(row[12]),
                "riskNote": rename_people(row[13]),
                "remark": rename_people(row[14]),
            }
        )
    return members, summary


def load_reassign_priorities(sheet) -> tuple[str, list[dict]]:
    date_label = text(sheet["A1"].value).replace("《怪物》今日优先任务 · ", "")
    tasks = []
    for row in sheet.iter_rows(min_row=6, values_only=True):
        priority = text(row[0])
        if not priority or not priority.startswith("P"):
            continue
        tasks.append(
            {
                "id": f"priority-{len(tasks) + 1:02d}",
                "priority": priority,
                "owner": rename_people(row[1]),
                "group": text(row[2]),
                "task": rename_people(row[3]),
                "scope": rename_people(row[4]),
                "shots": text(row[5]),
                "type": text(row[6]),
                "estimate": text(row[7]),
                "basis": rename_people(row[8]),
                "status": text(row[9]),
            }
        )
    return date_label, tasks


def build_reassigned_storyboard(
    source_storyboard: dict,
    shot_sheet,
    scene_assignments: dict,
) -> tuple[dict, dict]:
    scene_queues = {scene_name: deque(items) for scene_name, items in source_storyboard["sceneRows"].items()}
    scenes = {}
    owner_scene_counter = defaultdict(Counter)

    for row in shot_sheet.iter_rows(min_row=6, values_only=True):
        if not row[0]:
            continue
        scene_name = text(row[2])
        source_row = scene_queues.get(scene_name, deque()).popleft() if scene_queues.get(scene_name) else None
        new_owner = rename_people(row[4]) or (source_row["oldOwner"] if source_row else "未分配")
        status_label = text(row[8])
        director_note = rename_people(row[9])
        scene_info = scene_assignments.get(scene_name, {})
        scene_type = scene_info.get("sceneType", "")
        shot = {
            "sequence": as_int(row[0]),
            "originShotNo": text(row[1]),
            "shotId": source_row["shotId"] if source_row else text(row[1]),
            "sceneName": scene_name,
            "sceneCode": scene_info.get("sceneCode", scene_code(scene_name)),
            "sceneNumber": scene_info.get("sceneNumber", parse_scene_number(scene_name)),
            "originalOwner": rename_people(row[3]),
            "owner": new_owner,
            "group": text(row[5]),
            "description": rename_people(row[6]) or (source_row["description"] if source_row else ""),
            "dialogue": text(row[7]) or (source_row["dialogue"] if source_row else ""),
            "status": map_status_label(status_label),
            "statusLabel": status_label,
            "directorNote": director_note,
            "finalImage": text(row[10]),
            "referenceImage": text(row[11]),
            "priority": map_priority_label(text(row[12])),
            "remark": rename_people(row[13]),
            "type": infer_shot_type(text(row[5]), scene_type, status_label),
            "revisionRound": 1 if status_label == "需修改" else (0 if status_label in {"待制作", "已删除"} else 1),
            "issueTags": extract_issue_tags(director_note, scene_type, status_label),
        }

        if scene_name not in scenes:
            scenes[scene_name] = {
                "sceneId": f"scene-{parse_scene_number(scene_name):02d}",
                "sceneName": scene_name,
                "sceneCode": scene_code(scene_name),
                "sceneNumber": parse_scene_number(scene_name),
                "sceneDescription": scene_info.get("sceneDescription", ""),
                "sceneType": scene_type,
                "originalOwner": scene_info.get("originalOwner", ""),
                "totalShots": scene_info.get("totalShots", 0),
                "assignments": scene_info.get("assignments", []),
                "shots": [],
            }

        scenes[scene_name]["shots"].append(shot)
        if new_owner and new_owner != "LU":
            owner_scene_counter[new_owner][scene_name] += 1

    ordered_scenes = []
    for scene_name in sorted(scenes.keys(), key=scene_sort_key):
        scene = scenes[scene_name]
        counter = Counter(shot["status"] for shot in scene["shots"])
        scene["confirmedShots"] = counter.get("完成", 0)
        scene["revisionShots"] = counter.get("修改中", 0)
        scene["pendingShots"] = counter.get("未开始", 0)
        scene["deletedShots"] = counter.get("已删除", 0)
        scene["ownerSummary"] = " · ".join(
            f"{assignment['owner']} {assignment['assignedShots']}镜" for assignment in scene["assignments"]
        )
        ordered_scenes.append(scene)

    return {
        "trackedShots": sum(len(scene["shots"]) for scene in ordered_scenes),
        "sceneCount": len(ordered_scenes),
        "scenes": ordered_scenes,
    }, owner_scene_counter


def apply_storyboard_owner_overrides(storyboard: dict, owner_scene_counter: dict) -> None:
    for scene in storyboard["scenes"]:
        override = SCENE_OWNER_OVERRIDES.get(scene["sceneName"])
        if not override:
            continue

        old_owner = scene.get("originalOwner", "")
        target_owner = override["owner"]
        target_group = override.get("group", "")
        if override.get("sceneType"):
            scene["sceneType"] = override["sceneType"]
        scene["originalOwner"] = target_owner
        scene["ownerSummary"] = f"{target_owner} {scene['totalShots']}镜"
        scene["assignments"] = [
            {
                "owner": target_owner,
                "group": target_group,
                "assignedShots": scene["totalShots"],
                "confirmed": scene["confirmedShots"],
                "revision": scene["revisionShots"],
                "pending": scene["pendingShots"],
                "note": override.get("assignmentNote", ""),
            }
        ]

        for shot in scene["shots"]:
            if shot.get("originalOwner") in {old_owner, "LU"}:
                shot["originalOwner"] = target_owner
            if shot.get("owner") in {old_owner, "LU"}:
                shot["owner"] = target_owner

        owner_scene_counter[target_owner][scene["sceneName"]] = scene["totalShots"]


def get_team_profile(name: str, fallback_group: str = "制作组") -> dict:
    profile = TEAM_PLAN_PROFILES.get(name)
    if profile:
        return profile
    return {
        "group": fallback_group or "制作组",
        "preferredTypes": {"普通分镜"},
        "sceneKeywords": (),
    }


def matches_scene_keyword(scene_type: str, keywords: tuple[str, ...]) -> bool:
    return bool(scene_type and any(keyword in scene_type for keyword in keywords))


def build_assignment_note(owner: str, group: str, confirmed: int, revision: int, pending: int) -> str:
    if owner == REPAIR_OWNER:
        return "返修收口 / 风格统一" if revision else "修整组执行"
    if pending and confirmed:
        return f"{group}收口 + 新镜推进"
    if pending:
        return f"{group}承接待制作"
    if confirmed:
        return "已交付可用镜头"
    return f"{group}协作推进"


def rebalance_storyboard_plan(storyboard: dict) -> dict:
    assigned_counter = Counter()
    scene_owner_counter = defaultdict(Counter)
    pending_queue = []
    active_members = [name for name in TEAM_PLAN_PROFILES if name != REPAIR_OWNER]

    for scene in storyboard["scenes"]:
        scene_type = scene.get("sceneType", "")
        for shot in scene["shots"]:
            if scene["sceneName"] in SCENE_OWNER_OVERRIDES:
                target_owner = SCENE_OWNER_OVERRIDES[scene["sceneName"]]["owner"]
                profile = get_team_profile(target_owner)
                shot["owner"] = target_owner
                shot["originalOwner"] = target_owner
                shot["group"] = profile["group"]
                assigned_counter[target_owner] += 1
                scene_owner_counter[scene["sceneName"]][target_owner] += 1
                continue

            if shot["status"] == "修改中":
                profile = get_team_profile(REPAIR_OWNER)
                shot["owner"] = REPAIR_OWNER
                shot["group"] = profile["group"]
                shot["priority"] = "P0"
                assigned_counter[REPAIR_OWNER] += 1
                scene_owner_counter[scene["sceneName"]][REPAIR_OWNER] += 1
                continue

            if shot["status"] in {"完成", "已删除"}:
                profile = get_team_profile(shot["owner"], shot.get("group", ""))
                shot["group"] = profile["group"]
                assigned_counter[shot["owner"]] += 1
                scene_owner_counter[scene["sceneName"]][shot["owner"]] += 1
                continue

            pending_queue.append((scene, scene_type, shot))

    pending_queue.sort(key=lambda item: (item[0]["sceneNumber"], item[2]["sequence"]))

    for scene, scene_type, shot in pending_queue:
        candidates = []
        for member in active_members:
            profile = get_team_profile(member)
            score = assigned_counter[member]

            if shot["type"] not in profile["preferredTypes"]:
                score += 6
            if not matches_scene_keyword(scene_type, profile["sceneKeywords"]):
                score += 1.5
            if scene_owner_counter[scene["sceneName"]][member] > 0:
                score -= 1.75
            elif len(scene_owner_counter[scene["sceneName"]]) >= 2:
                score += 1.25
            if assigned_counter[member] >= 32:
                score += (assigned_counter[member] - 31) * 2
            if profile["group"] == "动作组" and shot["type"] == "动作镜":
                score -= 1.25
            if profile["group"] == "氛围组" and shot["type"] == "关键帧":
                score -= 1.0
            if profile["group"] == "文戏组" and shot["type"] == "普通分镜":
                score -= 0.75

            candidates.append((score, assigned_counter[member], member))

        candidates.sort()
        chosen_owner = candidates[0][2]
        chosen_profile = get_team_profile(chosen_owner)
        shot["owner"] = chosen_owner
        shot["group"] = chosen_profile["group"]
        assigned_counter[chosen_owner] += 1
        scene_owner_counter[scene["sceneName"]][chosen_owner] += 1

    for scene in storyboard["scenes"]:
        status_counter = Counter(shot["status"] for shot in scene["shots"])
        owner_counter = Counter(shot["owner"] for shot in scene["shots"])
        owner_status_counter = defaultdict(Counter)
        for shot in scene["shots"]:
            owner_status_counter[shot["owner"]][shot["status"]] += 1

        scene["confirmedShots"] = status_counter.get("完成", 0)
        scene["revisionShots"] = status_counter.get("修改中", 0)
        scene["pendingShots"] = status_counter.get("未开始", 0)
        scene["deletedShots"] = status_counter.get("已删除", 0)

        assignments = []
        for owner, shot_count in owner_counter.most_common():
            profile = get_team_profile(owner)
            owner_status = owner_status_counter[owner]
            assignments.append(
                {
                    "owner": owner,
                    "group": profile["group"],
                    "assignedShots": shot_count,
                    "confirmed": owner_status.get("完成", 0),
                    "revision": owner_status.get("修改中", 0),
                    "pending": owner_status.get("未开始", 0),
                    "note": build_assignment_note(
                        owner,
                        profile["group"],
                        owner_status.get("完成", 0),
                        owner_status.get("修改中", 0),
                        owner_status.get("未开始", 0),
                    ),
                }
            )

        scene["assignments"] = assignments
        scene["ownerSummary"] = " · ".join(f"{item['owner']} {item['assignedShots']}镜" for item in assignments)

    storyboard["trackedShots"] = sum(len(scene["shots"]) for scene in storyboard["scenes"])
    storyboard["sceneCount"] = len(storyboard["scenes"])
    return scene_owner_counter


def build_member_priority(queue: list[dict], statuses: tuple[str, ...], label: str) -> str:
    filtered = [shot for shot in queue if shot["status"] in statuses]
    if not filtered:
        return ""
    scene_counter = Counter(shot["sceneName"] for shot in filtered)
    scene_name, count = scene_counter.most_common(1)[0]
    scene_code = next(shot["sceneCode"] for shot in filtered if shot["sceneName"] == scene_name)
    return f"{scene_code} {scene_name}{label} × {count}"


def build_weekly_goal(queue: list[dict]) -> str:
    unresolved = [shot for shot in queue if shot["status"] in {"修改中", "未开始"}]
    if not unresolved:
        return "本周无新增镜头"
    scene_counter = Counter(shot["sceneName"] for shot in unresolved)
    top_scenes = [f"{scene_name}{count}镜" for scene_name, count in scene_counter.most_common(2)]
    return " + ".join(top_scenes)


def build_scene_scope(scene_coverage: list[dict]) -> str:
    if not scene_coverage:
        return "当前无镜头分配"
    labels = [item["sceneName"] for item in scene_coverage[:4]]
    if len(scene_coverage) > 4:
        labels.append("等")
    return " / ".join(labels)


def build_member_risk_note(name: str, remaining: int, revision: int, scene_coverage: list[dict], fallback: str) -> str:
    if name == REPAIR_OWNER and revision:
        return "专注返修收口，避免再接新镜"
    if revision >= 8:
        return "返修镜头偏多，先清积压再开新镜"
    if remaining >= 28:
        return "剩余镜头较多，需锁定 2-3 个主场次"
    if len(scene_coverage) >= 5:
        return "跨场次过多，注意风格一致"
    return fallback or "节奏稳定"


def build_ai_team_rollup(
    storyboard_scenes: list[dict],
    daily_rows: list[dict],
    overview_rows: list[dict],
) -> tuple[list[dict], list[dict], dict, dict]:
    queue_by_owner = defaultdict(list)
    owner_scene_counter = defaultdict(Counter)

    for scene in storyboard_scenes:
        for shot in scene["shots"]:
            queue_by_owner[shot["owner"]].append(shot)
            owner_scene_counter[shot["owner"]][scene["sceneName"]] += 1

    daily_map = {row["name"]: row for row in daily_rows}
    overview_map = {row["name"]: row for row in overview_rows}

    ai_team = []
    reassign_overview = []
    today_tasks = []

    for name in TEAM_PLAN_PROFILES:
        queue = sorted(queue_by_owner.get(name, []), key=lambda item: (item["sceneNumber"], item["sequence"]))
        profile = get_team_profile(name)
        daily_row = daily_map.get(name, {})
        overview = overview_map.get(name, {})
        status_counter = Counter(shot["status"] for shot in queue)
        assigned_shots = len(queue)
        done = status_counter.get("完成", 0)
        revision = status_counter.get("修改中", 0)
        pending = status_counter.get("未开始", 0)
        remaining = revision + pending

        if name == REPAIR_OWNER:
            daily_target = 5 if remaining else 3
        elif remaining >= 24:
            daily_target = 4
        elif remaining >= 10:
            daily_target = 3
        elif remaining > 0:
            daily_target = 2
        else:
            daily_target = 0

        estimated_days = round(remaining / daily_target, 1) if daily_target else 0.0
        scene_coverage = [
            {"sceneName": scene_name, "shots": count}
            for scene_name, count in owner_scene_counter.get(name, Counter()).most_common()
        ]
        scene_scope = build_scene_scope(scene_coverage)
        today_p0 = build_member_priority(queue, ("修改中",), "返修")
        today_p1 = build_member_priority(queue, ("未开始",), "待制作")
        weekly_goal = build_weekly_goal(queue)
        risk_note = build_member_risk_note(name, remaining, revision, scene_coverage, daily_row.get("riskNote", ""))
        priority_label = "P0" if today_p0 else ("P1" if today_p1 else "P2")

        ai_team.append(
            {
                "name": name,
                "group": profile["group"],
                "specialty": daily_row.get("remark") or overview.get("remark") or profile["group"],
                "assignedShots": assigned_shots,
                "done": done,
                "revision": revision,
                "pending": pending,
                "progress": round((done / assigned_shots) * 100, 1) if assigned_shots else 0,
                "dailyTarget": daily_target,
                "estimatedDays": estimated_days,
                "todayPriority": priority_label,
                "priorityNote": today_p0 or today_p1 or "",
                "episodeScope": "EP01",
                "remark": daily_row.get("remark") or overview.get("remark") or "",
                "sceneScope": scene_scope,
                "remainingWorkload": remaining,
                "weeklyGoal": weekly_goal,
                "riskNote": risk_note,
                "todayP0": today_p0,
                "todayP1": today_p1,
                "sceneCoverage": scene_coverage,
                "todayTasks": [],
                "queue": queue,
            }
        )

        reassign_overview.append(
            {
                "name": name,
                "currentShots": assigned_shots,
                "currentRatio": 0,
                "reassignedShots": assigned_shots,
                "ratio": 0,
                "group": profile["group"],
                "sceneSummary": scene_scope if scene_scope != "当前无镜头分配" else "",
                "confirmed": done,
                "revision": revision,
                "pending": pending,
                "dailyTarget": daily_target,
                "estimatedDays": f"{estimated_days}天" if estimated_days else "",
                "todayPriority": today_p0 or today_p1 or "",
                "remark": risk_note,
            }
        )

        if today_p0:
            today_tasks.append(
                {
                    "id": f"priority-{len(today_tasks) + 1:02d}",
                    "priority": "P0",
                    "owner": name,
                    "group": profile["group"],
                    "task": today_p0,
                    "scope": scene_scope,
                    "shots": f"{revision}镜" if revision else "",
                    "type": "返修",
                    "estimate": f"{daily_target}镜/日" if daily_target else "",
                    "basis": weekly_goal,
                    "status": "执行中",
                }
            )
        if today_p1:
            pending_scene_count = max((scene["shots"] for scene in scene_coverage), default=0)
            today_tasks.append(
                {
                    "id": f"priority-{len(today_tasks) + 1:02d}",
                    "priority": "P1",
                    "owner": name,
                    "group": profile["group"],
                    "task": today_p1,
                    "scope": scene_scope,
                    "shots": f"{pending_scene_count}镜" if pending_scene_count else "",
                    "type": "待制作",
                    "estimate": f"{daily_target}镜/日" if daily_target else "",
                    "basis": weekly_goal,
                    "status": "排期中",
                }
            )

    summary = Counter()
    for scene in storyboard_scenes:
        for shot in scene["shots"]:
            summary[shot["status"]] += 1

    reassign_summary = {
        "name": "合计",
        "currentShots": sum(member["assignedShots"] for member in ai_team),
        "currentRatio": 0,
        "reassignedShots": sum(member["assignedShots"] for member in ai_team),
        "ratio": 0,
        "group": "",
        "sceneSummary": "",
        "confirmed": summary.get("完成", 0),
        "revision": summary.get("修改中", 0),
        "pending": summary.get("未开始", 0),
        "dailyTarget": sum(member["dailyTarget"] for member in ai_team),
        "estimatedDays": "",
        "todayPriority": "",
        "remark": "",
    }
    daily_summary = {
        "assignedShots": sum(member["assignedShots"] for member in ai_team),
        "confirmed": summary.get("完成", 0),
        "revision": summary.get("修改中", 0),
        "pending": summary.get("未开始", 0),
        "remaining": sum(member["remainingWorkload"] for member in ai_team),
    }
    return ai_team, reassign_overview, reassign_summary, daily_summary, today_tasks


def merge_ai_team(
    overview_rows: list[dict],
    daily_rows: list[dict],
    owner_scene_counter: dict,
    priorities: list[dict],
    storyboard_scenes: list[dict],
) -> list[dict]:
    ai_team, _, _, _, _ = build_ai_team_rollup(storyboard_scenes, daily_rows, overview_rows)
    return ai_team


def build_output() -> dict:
    project_book = load_workbook(find_latest_workbook(PROJECT_HINT), data_only=True)
    storyboard_book = load_workbook(find_latest_workbook(STORYBOARD_HINT), data_only=True)
    reassign_book = load_workbook(find_latest_workbook(REASSIGN_HINT), data_only=True)

    project, episodes = load_project_overview(project_book["项目总览"])
    core_team = load_core_team(project_book["团队分工"])
    pipeline = load_pipeline(project_book["制作管线"])
    risks = load_risks(project_book["风险预警"])
    episode_schedule = load_episode_schedule(project_book["分集排期"])
    assets, asset_summary = load_assets(project_book["资产管理"])

    source_storyboard = load_storyboard_source(storyboard_book[storyboard_book.sheetnames[0]])
    reassign_overview_rows, _ = load_reassign_overview(reassign_book["分配总览"])
    scene_assignments = load_scene_assignments(reassign_book["场次分配明细"])
    daily_workloads, _ = load_daily_workloads(reassign_book["每日任务量"])
    priority_date, _ = load_reassign_priorities(reassign_book["今日优先级"])
    storyboard, owner_scene_counter = build_reassigned_storyboard(
        source_storyboard,
        reassign_book["298镜分配明细"],
        scene_assignments,
    )
    apply_storyboard_owner_overrides(storyboard, owner_scene_counter)
    owner_scene_counter = rebalance_storyboard_plan(storyboard)
    (
        ai_team,
        reassign_overview,
        reassign_summary,
        daily_summary,
        priorities,
    ) = build_ai_team_rollup(storyboard["scenes"], daily_workloads, reassign_overview_rows)

    project["trackedShots"] = storyboard["trackedShots"]
    project["priorityDate"] = priority_date
    project["reassignSummary"] = reassign_summary
    project["dailySummary"] = daily_summary
    project["priorityCount"] = len(priorities)

    return {
        "project": project,
        "episodes": episodes,
        "coreTeam": core_team,
        "aiTeam": ai_team,
        "pipeline": pipeline,
        "risks": risks,
        "episodeSchedule": episode_schedule,
        "assets": assets,
        "assetSummary": asset_summary,
        "priorities": priorities,
        "storyboard": storyboard,
        "sceneAssignments": list(scene_assignments.values()),
        "reassignOverview": reassign_overview,
    }


def main() -> None:
    output = build_output()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入 {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
