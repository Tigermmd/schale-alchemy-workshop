#!/usr/bin/env python3
"""Generate Japanese names for the dashboard's existing data snapshot."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


SCHaleDB_STUDENTS_JP_URL = "https://schaledb.com/data/jp/students.min.json"
SCHaleDB_ITEMS_JP_URL = "https://schaledb.com/data/jp/items.min.json"
SCHaleDB_CRAFTING_JP_URL = (
    "https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/crafting_jp.json"
)


def read_json(path_or_url: str):
    if path_or_url.startswith("http"):
        request = Request(path_or_url, headers={"User-Agent": "BlueArchiveResearch/1.0"})
        with urlopen(request, timeout=90) as response:
            return json.load(response)
    with open(path_or_url, encoding="utf-8") as handle:
        return json.load(handle)


def record_index(records: dict) -> dict[str, dict]:
    return {str(record["Id"]): record for record in records.values()}


def snapshot_ids(data_dir: Path) -> tuple[set[str], set[str], set[str]]:
    students = json.loads(
        (data_dir / "student_gift_preferences.json").read_text(encoding="utf-8")
    )
    gifts = json.loads((data_dir / "gifts.json").read_text(encoding="utf-8"))
    crafting = json.loads(
        (data_dir / "crafting_expected_relationship.json").read_text(encoding="utf-8")
    )
    student_ids = {str(student["student_id"]) for student in students["students"]}
    gift_ids = {str(gift["id"]) for gift in gifts["gifts"]}
    node_ids = {
        str(node["id"])
        for stage_nodes in crafting["crafting_probability"]["node_distributions"].values()
        for node in stage_nodes
    }
    return student_ids, gift_ids, node_ids


def require_names(names: dict[str, str], ids: set[str], label: str) -> None:
    missing = sorted(ids - set(names))
    if missing:
        raise ValueError(f"{label} Japanese names missing for IDs: {missing[:20]}")


def dump_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--students-jp", default=SCHaleDB_STUDENTS_JP_URL)
    parser.add_argument("--items-jp", default=SCHaleDB_ITEMS_JP_URL)
    parser.add_argument("--crafting-jp", default=SCHaleDB_CRAFTING_JP_URL)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).parent)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("localization.json"))
    args = parser.parse_args()

    student_ids, gift_ids, node_ids = snapshot_ids(args.data_dir)
    students_jp = record_index(read_json(args.students_jp))
    items_jp = record_index(read_json(args.items_jp))
    crafting_jp = read_json(args.crafting_jp)
    nodes_jp = record_index({str(node["Id"]): node for node in crafting_jp["Nodes"]})

    student_names = {student_id: students_jp[student_id]["Name"] for student_id in student_ids if student_id in students_jp}
    gift_names = {gift_id: items_jp[gift_id]["Name"] for gift_id in gift_ids if gift_id in items_jp}
    node_names = {node_id: nodes_jp[node_id]["NameJp"] for node_id in node_ids if node_id in nodes_jp}
    require_names(student_names, student_ids, "student")
    require_names(gift_names, gift_ids, "gift")
    require_names(node_names, node_ids, "node")

    retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    dump_json(
        args.output,
        {
            "schema_version": 1,
            "scope": {
                "language": "trilingual",
                "languages": {"zh_cn": "cn", "en": "en", "ja": "jp"},
                "student_count": len(student_names),
                "gift_count": len(gift_names),
                "node_count": len(node_names),
            },
            "source": {
                "retrieved_at": retrieved_at,
                "students_jp": args.students_jp,
                "items_jp": args.items_jp,
                "crafting_jp": args.crafting_jp,
                "translation_source": "SchaleDB data/jp (JP region data)",
            },
            "students": student_names,
            "gifts": gift_names,
            "nodes": node_names,
        },
    )
    print(json.dumps({"output": str(args.output), "students": len(student_names), "gifts": len(gift_names), "nodes": len(node_names)}))


if __name__ == "__main__":
    main()
