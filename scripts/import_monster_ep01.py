from __future__ import annotations

import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET


DOWNLOADS = Path.home() / "Downloads"
OUTPUT_PATH = Path("src/data/monsterEp01Data.json")

XLSX_NAME_HINT = "分镜头脚本"
DOCX_NAME_HINT = "EP01"

NS_DOCX = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
NS_XLSX = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

STATUS_MAP = {
    "完成": "done",
    "修改中": "revision",
    "未开始": "pending",
}

MODULE_STATUS_ORDER = ["pending", "active", "done"]

MODULE_DEFAULTS = {
    "scriptDev": {
        "title": "剧本开发",
        "description": "主线梳理 / 分集大纲 / 分集剧本",
        "subitems": [
            {"key": "storyMainline", "label": "主线梳理", "status": "done"},
            {"key": "episodeOutline", "label": "分集大纲", "status": "done"},
            {"key": "episodeScript", "label": "分集剧本", "status": "active"},
        ],
    },
    "assetDev": {
        "title": "资产管理",
        "description": "人物设计 / 场景设计",
        "subitems": [
            {"key": "characterDesign", "label": "人物设计", "status": "active"},
            {"key": "sceneDesign", "label": "场景设计", "status": "active"},
        ],
    },
    "storyboardDev": {
        "title": "分镜制作",
        "description": "分集文字分镜 / 漫画转 AI 图片分镜",
        "subitems": [
            {"key": "episodeStoryboard", "label": "文字分镜", "status": "active"},
            {"key": "comicToImage", "label": "图片分镜", "status": "active"},
        ],
    },
    "postDev": {
        "title": "后期",
        "description": "视频制作 / 音乐后期",
        "subitems": [
            {"key": "videoProduction", "label": "视频制作", "status": "pending"},
            {"key": "musicPost", "label": "音乐后期", "status": "pending"},
        ],
    },
}


def find_latest_file(pattern: str, suffix: str) -> Path:
    candidates = [
        path
        for path in DOWNLOADS.iterdir()
        if path.suffix.lower() == suffix.lower() and pattern in path.name and not path.name.startswith("~$")
    ]
    if not candidates:
        raise FileNotFoundError(f"Could not find {suffix} file containing {pattern!r} in {DOWNLOADS}")
    return sorted(candidates, key=lambda item: item.stat().st_mtime, reverse=True)[0]


def col_to_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    value = 0
    for ch in letters:
        value = value * 26 + (ord(ch.upper()) - 64)
    return value - 1


def parse_xlsx_rows(path: Path) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("a:si", NS_XLSX):
                shared_strings.append("".join(text.text or "" for text in item.findall(".//a:t", NS_XLSX)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        first_sheet = workbook.find("a:sheets", NS_XLSX)[0]
        target = rel_map[
            first_sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        ].lstrip("/")
        sheet_rows = ET.fromstring(archive.read(target)).findall(".//a:sheetData/a:row", NS_XLSX)

        def cell_value(cell: ET.Element) -> str:
            cell_type = cell.attrib.get("t")
            value_node = cell.find("a:v", NS_XLSX)
            if value_node is None:
                inline = cell.find("a:is", NS_XLSX)
                if inline is not None:
                    return "".join(text.text or "" for text in inline.findall(".//a:t", NS_XLSX)).strip()
                return ""
            raw = value_node.text or ""
            if cell_type == "s":
                index = int(raw)
                return shared_strings[index] if index < len(shared_strings) else raw
            return raw.strip()

        rows: list[list[str]] = []
        for row in sheet_rows:
            dense: dict[int, str] = {}
            for cell in row.findall("a:c", NS_XLSX):
                dense[col_to_index(cell.attrib["r"])] = cell_value(cell)
            max_index = max(dense) if dense else -1
            rows.append([dense.get(i, "") for i in range(max_index + 1)])
        return rows


def parse_storyboard(path: Path) -> dict:
    rows = parse_xlsx_rows(path)
    header = rows[0]
    records = []
    for row in rows[1:]:
        if len(row) < 2:
            continue
        scene_name = row[0].strip() if len(row) > 0 else ""
        shot_no = row[1].strip() if len(row) > 1 else ""
        if not scene_name or not shot_no:
            continue
        padded = row + [""] * (len(header) - len(row))
        shot = dict(zip(header, padded))
        status_label = shot.get("状态", "").strip()
        records.append(
            {
                "sceneName": scene_name,
                "shotNo": shot_no,
                "shotId": shot.get("镜号", "").strip() or shot_no,
                "description": shot.get("文字描述（画面描述，景别，摄影机角度）", "").strip(),
                "dialogue": shot.get("台词", "").strip(),
                "owner": shot.get("制作者", "").strip() or "未分配",
                "referenceImage": shot.get("参考画面", "").strip(),
                "statusLabel": status_label or "未开始",
                "status": STATUS_MAP.get(status_label, "pending"),
                "finalImage": shot.get("确定画面", "").strip(),
                "direction": shot.get("方向", "").strip(),
                "directorNote": shot.get("导演修改意见", "").strip(),
                "postImage": shot.get("后期处理画面", "").strip(),
                "imagePrompt": shot.get("图片提示词", "").strip(),
                "mixNote": shot.get("MIX混声细节", "").strip(),
                "cameraMove": shot.get("运镜", "").strip(),
                "performanceNote": shot.get("补充视频表演状态", "").strip(),
                "pendingVideo": shot.get("待检验视频素材 命名规则为场号-镜号", "").strip(),
                "videoNote": shot.get("视频修改意见", "").strip(),
                "finalVideo": shot.get("最终确定视频素材 U-场号-镜号", "").strip(),
                "videoPrompt": shot.get("视频提示词", "").strip(),
                "reviewNote": shot.get("导演与制片核验", "").strip(),
                "parentRecord": shot.get("父记录", "").strip(),
            }
        )

    scene_order: dict[str, int] = {}
    for scene_name in [item["sceneName"] for item in records]:
        if scene_name not in scene_order:
            scene_order[scene_name] = len(scene_order) + 1

    owner_counter = Counter(item["owner"] for item in records)
    status_counter = Counter(item["statusLabel"] for item in records)

    return {
        "shots": records,
        "sceneOrder": scene_order,
        "teamMembers": sorted(owner_counter.keys(), key=lambda name: (name == "未分配", name)),
        "summary": {
            "totalShots": len(records),
            "statusCounts": dict(status_counter),
            "ownerCounts": dict(owner_counter),
            "textCoverage": sum(1 for item in records if item["description"] or item["dialogue"]),
            "referenceCoverage": sum(1 for item in records if item["referenceImage"]),
            "finalImageCoverage": sum(1 for item in records if item["finalImage"]),
            "finalVideoCoverage": sum(1 for item in records if item["finalVideo"]),
        },
    }


def parse_docx(path: Path) -> tuple[list[str], list[list[list[str]]]]:
    with zipfile.ZipFile(path) as archive:
        document_xml = ET.fromstring(archive.read("word/document.xml"))

    paragraphs: list[str] = []
    for paragraph in document_xml.findall(".//w:p", NS_DOCX):
        text = "".join(run.text or "" for run in paragraph.findall(".//w:t", NS_DOCX)).strip()
        if text:
            paragraphs.append(text)

    tables: list[list[list[str]]] = []
    for table in document_xml.findall(".//w:tbl", NS_DOCX):
        rows: list[list[str]] = []
        for row in table.findall("./w:tr", NS_DOCX):
            cells: list[str] = []
            for cell in row.findall("./w:tc", NS_DOCX):
                cell_text = "".join(text.text or "" for text in cell.findall(".//w:t", NS_DOCX)).strip()
                cells.append(cell_text)
            rows.append(cells)
        if rows:
            tables.append(rows)
    return paragraphs, tables


def parse_plan(path: Path) -> dict:
    paragraphs, tables = parse_docx(path)
    metadata_line = paragraphs[2]
    people_line = paragraphs[3]

    metadata_match = re.search(
        r"截止日：(?P<deadline>[^|]+)\s+\|\s+制定日：(?P<planDate>[^|]+)\s+\|\s+(?P<workdays>.+)$",
        metadata_line,
    )
    people_match = re.search(r"制片：(?P<producer>[^|]+)\s+\|\s+制作：(?P<makers>.+)$", people_line)

    summary_table = tables[0]
    overview_table = tables[1]
    checkpoint_table = tables[7]
    weekly_total_table = tables[8]

    summary = {
        summary_table[0][idx]: summary_table[1][idx]
        for idx in range(min(len(summary_table[0]), len(summary_table[1])))
    }

    scene_rows = []
    for row in overview_table[1:]:
        if not row or not row[0]:
            continue
        scene_rows.append(
            {
                "sceneName": row[0],
                "totalShots": int(row[1]),
                "doneShots": int(row[2]),
                "revisionShots": int(row[3]),
                "pendingShots": int(row[4]),
                "ownerLabel": row[5],
                "weekLabel": row[6],
                "typeLabel": row[7],
                "note": row[8] if len(row) > 8 else "",
            }
        )

    week_tables = tables[2:7]
    week_blocks: dict[str, dict] = {}
    for index, paragraph in enumerate(paragraphs):
        week_match = re.match(r"^(W\d)\s+(.+)$", paragraph)
        if not week_match:
            continue
        week_id = week_match.group(1)
        week_info = {
            "week": week_id,
            "dateRange": week_match.group(2).strip(),
            "goal": "",
            "nature": "",
            "notes": [],
            "weekend": "",
        }
        cursor = index + 1
        while cursor < len(paragraphs):
            line = paragraphs[cursor]
            if re.match(r"^W\d\s+", line) or re.match(r"^[一二三四五六七八九十]+、", line):
                break
            if line.startswith("目标："):
                week_info["goal"] = line.split("：", 1)[1]
            elif line.startswith("本周性质："):
                week_info["nature"] = line.split("：", 1)[1]
            elif line.startswith("周末休息："):
                week_info["weekend"] = line.split("：", 1)[1]
            elif line.startswith("注意：") or line.startswith("每日必检："):
                week_info["notes"].append(line)
            cursor += 1
        week_blocks[week_id] = week_info

    weekly_totals = []
    for row in weekly_total_table[1:]:
        if not row or not row[0]:
            continue
        weekly_totals.append(
            {
                "week": row[0],
                "workdays": row[1],
                "targetShots": row[2],
                "ownerMin": row[3],
                "ownerMing": row[4],
                "cumulative": row[5],
            }
        )

    weekly_assignments = []
    for index, table in enumerate(week_tables, start=1):
        week_id = f"W{index}"
        week_meta = week_blocks.get(week_id, {"week": week_id, "dateRange": "", "goal": "", "nature": "", "notes": []})
        assignments = []
        for row in table[1:]:
            if not row or not row[0]:
                continue
            assignments.append(
                {
                    "member": row[0],
                    "task": row[1],
                    "shots": row[2],
                    "dailyAverage": row[3],
                    "successMarker": row[4],
                }
            )
        total_row = next((item for item in weekly_totals if item["week"] == week_id), None)
        week_meta["targetShots"] = total_row["targetShots"] if total_row else ""
        week_meta["workdays"] = total_row["workdays"] if total_row else ""
        week_meta["cumulative"] = total_row["cumulative"] if total_row else ""
        week_meta["assignments"] = assignments
        weekly_assignments.append(week_meta)

    checkpoints = []
    for row in checkpoint_table[1:]:
        if not row or not row[0]:
            continue
        checkpoints.append(
            {
                "date": row[0],
                "target": row[1],
                "riskSignal": row[2],
                "response": row[3],
            }
        )

    routines = []
    in_routine_section = False
    current_routine = None
    for line in paragraphs:
        if line == "四、每日执行节奏":
            in_routine_section = True
            continue
        if line == "五、四个检查点":
            break
        if not in_routine_section:
            continue
        if "—" in line and re.match(r"^(上午|中午|下午|晚上)?\d{1,2}:\d{2}", line):
            if current_routine:
                routines.append(current_routine)
            time_label, title = [part.strip() for part in line.split("—", 1)]
            current_routine = {"time": time_label, "title": title, "detail": ""}
        elif current_routine:
            current_routine["detail"] = line
    if current_routine:
        routines.append(current_routine)

    plan_b = []
    in_plan_b = False
    for line in paragraphs:
        if line == "七、Plan B":
            in_plan_b = True
            continue
        if not in_plan_b:
            continue
        if re.match(r"^\d+\.", line):
            plan_b.append(re.sub(r"^\d+\.\s*", "", line))

    return {
        "title": paragraphs[0],
        "subtitle": paragraphs[1],
        "deadline": metadata_match.group("deadline").strip() if metadata_match else "",
        "planDate": metadata_match.group("planDate").strip() if metadata_match else "",
        "workdaysLabel": metadata_match.group("workdays").strip() if metadata_match else "",
        "producer": people_match.group("producer").strip() if people_match else "",
        "makers": [name.strip() for name in (people_match.group("makers").split("、") if people_match else [])],
        "diagnosis": {
            "summary": summary,
            "timeAccount": next((line for line in paragraphs if line.startswith("时间账：")), ""),
            "rebalance": next((line for line in paragraphs if line.startswith("工作量分布不均：")), ""),
            "modificationNote": next((line for line in paragraphs if line.startswith("修改中（")), ""),
            "newWorkNote": next((line for line in paragraphs if line.startswith("未开始（")), ""),
        },
        "sceneOverview": scene_rows,
        "weeks": weekly_assignments,
        "checkpoints": checkpoints,
        "weeklyTotals": weekly_totals,
        "routines": routines,
        "planB": plan_b,
    }


def normalize_module_metrics(storyboard: dict, plan: dict) -> list[dict]:
    total_shots = storyboard["summary"]["totalShots"]
    text_coverage = storyboard["summary"]["textCoverage"]
    reference_coverage = storyboard["summary"]["referenceCoverage"]
    final_image_coverage = storyboard["summary"]["finalImageCoverage"]
    final_video_coverage = storyboard["summary"]["finalVideoCoverage"]

    planned_done = int(plan["diagnosis"]["summary"].get("已完成", "0"))
    planned_revision = int(plan["diagnosis"]["summary"].get("修改中", "0"))
    planned_pending = int(plan["diagnosis"]["summary"].get("未开始", "0"))

    return [
        {
            "key": "scriptDev",
            "title": MODULE_DEFAULTS["scriptDev"]["title"],
            "description": MODULE_DEFAULTS["scriptDev"]["description"],
            "progress": round((text_coverage / total_shots) * 100),
            "metricLabel": f"{text_coverage}/{total_shots} 镜含文字描述或台词",
            "status": "active" if text_coverage < total_shots else "done",
            "subitems": MODULE_DEFAULTS["scriptDev"]["subitems"],
        },
        {
            "key": "assetDev",
            "title": MODULE_DEFAULTS["assetDev"]["title"],
            "description": MODULE_DEFAULTS["assetDev"]["description"],
            "progress": round((reference_coverage / total_shots) * 100),
            "metricLabel": f"{reference_coverage}/{total_shots} 镜已挂参考画面",
            "status": "done" if reference_coverage >= total_shots else "active",
            "subitems": MODULE_DEFAULTS["assetDev"]["subitems"],
        },
        {
            "key": "storyboardDev",
            "title": MODULE_DEFAULTS["storyboardDev"]["title"],
            "description": MODULE_DEFAULTS["storyboardDev"]["description"],
            "progress": round((planned_done / total_shots) * 100),
            "metricLabel": f"{planned_done} 完成 / {planned_revision} 修改中 / {planned_pending} 未开始",
            "status": "active",
            "subitems": MODULE_DEFAULTS["storyboardDev"]["subitems"],
        },
        {
            "key": "postDev",
            "title": MODULE_DEFAULTS["postDev"]["title"],
            "description": MODULE_DEFAULTS["postDev"]["description"],
            "progress": round((final_video_coverage / total_shots) * 100),
            "metricLabel": f"{final_image_coverage} 镜有确定画面，最终视频素材 {final_video_coverage} 镜",
            "status": "pending" if final_video_coverage == 0 else "active",
            "subitems": MODULE_DEFAULTS["postDev"]["subitems"],
        },
    ]


def build_scenes(storyboard: dict, plan: dict) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for shot in storyboard["shots"]:
        grouped[shot["sceneName"]].append(shot)

    scene_rows = {scene["sceneName"]: scene for scene in plan["sceneOverview"]}
    scene_order = storyboard["sceneOrder"]
    scenes = []
    for scene_name, order in sorted(scene_order.items(), key=lambda item: item[1]):
        shots = grouped.get(scene_name, [])
        overview = scene_rows.get(scene_name, {})
        counts = Counter(item["status"] for item in shots)
        scenes.append(
            {
                "id": f"scene-{order:02d}",
                "order": order,
                "name": scene_name,
                "ownerLabel": overview.get("ownerLabel", ""),
                "weekLabel": overview.get("weekLabel", ""),
                "typeLabel": overview.get("typeLabel", ""),
                "note": overview.get("note", ""),
                "totalShots": len(shots),
                "doneShots": counts.get("done", 0),
                "revisionShots": counts.get("revision", 0),
                "pendingShots": counts.get("pending", 0),
                "progress": round((counts.get("done", 0) / len(shots)) * 100) if shots else 0,
                "shots": shots,
            }
        )
    return scenes


def build_owner_load(scenes: list[dict], plan: dict) -> list[dict]:
    owner_totals: dict[str, dict] = defaultdict(
        lambda: {
            "member": "",
            "scenes": set(),
            "totalShots": 0,
            "doneShots": 0,
            "revisionShots": 0,
            "pendingShots": 0,
        }
    )
    for scene in scenes:
        for shot in scene["shots"]:
            owner = shot["owner"]
            record = owner_totals[owner]
            record["member"] = owner
            record["scenes"].add(scene["name"])
            record["totalShots"] += 1
            record["doneShots"] += 1 if shot["status"] == "done" else 0
            record["revisionShots"] += 1 if shot["status"] == "revision" else 0
            record["pendingShots"] += 1 if shot["status"] == "pending" else 0

    week_assignments = defaultdict(list)
    for week in plan["weeks"]:
        for assignment in week["assignments"]:
            week_assignments[assignment["member"]].append(
                {
                    "week": week["week"],
                    "task": assignment["task"],
                    "shots": assignment["shots"],
                    "dailyAverage": assignment["dailyAverage"],
                    "successMarker": assignment["successMarker"],
                }
            )

    owner_load = []
    for owner, record in owner_totals.items():
        owner_load.append(
            {
                "member": owner,
                "sceneCount": len(record["scenes"]),
                "totalShots": record["totalShots"],
                "doneShots": record["doneShots"],
                "revisionShots": record["revisionShots"],
                "pendingShots": record["pendingShots"],
                "progress": round((record["doneShots"] / record["totalShots"]) * 100) if record["totalShots"] else 0,
                "plannedAssignments": week_assignments.get(owner, []),
            }
        )
    return sorted(owner_load, key=lambda item: item["totalShots"], reverse=True)


def build_dataset(storyboard: dict, plan: dict) -> dict:
    total_shots = storyboard["summary"]["totalShots"]
    scenes = build_scenes(storyboard, plan)
    modules = normalize_module_metrics(storyboard, plan)
    owner_load = build_owner_load(scenes, plan)
    summary = plan["diagnosis"]["summary"]
    total_done = int(summary.get("已完成", "0"))
    total_revision = int(summary.get("修改中", "0"))
    total_pending = int(summary.get("未开始", "0"))
    completion_rate = float(summary.get("完成率", "0").rstrip("%") or 0)

    return {
        "project": {
            "id": "monster-ep01",
            "name": "怪物 EP01",
            "title": "怪物制片工作台",
            "subtitle": "分镜制作攻坚总控台",
            "deadline": plan["deadline"],
            "planDate": plan["planDate"],
            "workdaysLabel": plan["workdaysLabel"],
            "producer": plan["producer"],
            "makers": plan["makers"],
            "episodeLabel": "EP01",
            "sceneCount": len(scenes),
            "totalShots": total_shots,
            "teamMembers": storyboard["teamMembers"],
            "summary": {
                "completed": total_done,
                "revision": total_revision,
                "pending": total_pending,
                "remaining": total_shots - total_done,
                "completionRate": completion_rate,
                "needsDelivery": summary.get("需完成", ""),
            },
            "diagnosis": plan["diagnosis"],
        },
        "modules": modules,
        "storyboard": {
            "scenes": scenes,
            "ownerLoad": owner_load,
            "shots": storyboard["shots"],
            "coverage": {
                "textCoverage": storyboard["summary"]["textCoverage"],
                "referenceCoverage": storyboard["summary"]["referenceCoverage"],
                "finalImageCoverage": storyboard["summary"]["finalImageCoverage"],
                "finalVideoCoverage": storyboard["summary"]["finalVideoCoverage"],
            },
        },
        "plan": {
            "weeks": plan["weeks"],
            "checkpoints": plan["checkpoints"],
            "weeklyTotals": plan["weeklyTotals"],
            "routines": plan["routines"],
            "planB": plan["planB"],
        },
        "defaults": {
            "members": storyboard["teamMembers"],
            "moduleState": {
                module["key"]: {
                    "status": module["status"],
                    "subitems": {subitem["key"]: subitem["status"] for subitem in module["subitems"]},
                }
                for module in modules
            },
        },
    }


def main() -> None:
    xlsx_path = find_latest_file(XLSX_NAME_HINT, ".xlsx")
    docx_path = find_latest_file(DOCX_NAME_HINT, ".docx")
    storyboard = parse_storyboard(xlsx_path)
    plan = parse_plan(docx_path)
    dataset = build_dataset(storyboard, plan)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} from:")
    print(f"  storyboard: {xlsx_path}")
    print(f"  plan:       {docx_path}")


if __name__ == "__main__":
    main()
