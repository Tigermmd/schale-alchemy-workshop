#!/usr/bin/env python3
"""Calculate the maximum relationship EXP from a complete three-stage craft.

Each unlocked stage displays five randomly generated node options.  The player
chooses one option, and the selected node contributes one reward to that stage
of the craft.  Therefore the stage expectation is the expected maximum of five
node scores, not the expectation of one randomly selected node and not a free
choice from the whole node pool.

The model charges one manufacturing stone to start stage 1.  Stages 2 and 3
use other in-game materials and are therefore free in the manufacturing-stone
efficiency denominator, per the simulator's scope.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


CRAFTING_CN_URL = (
    "https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/crafting_cn.json"
)
CRAFTING_PAGE_URL = "https://schaledb.com/crafting"
STAGE_COST_SOURCE_URL = "https://www.taptap.cn/moment/438067301988698078"
CRAFTING_MECHANISM_SOURCE_URL = "https://bluearchive.wikiru.jp/?%E8%A3%BD%E9%80%A0"
STAGE_STONE_COSTS = {"1": 1, "2": 0, "3": 0}
FRAGMENT_EQUIVALENT = 10
NODE_OPTION_COUNT = 5
NON_GIFT_OUTPUT_POLICY = (
    "discard non-gift rewards and treat them as zero relationship EXP and zero gift quantity"
)


def read_json(path_or_url: str):
    if path_or_url.startswith("http"):
        request = Request(path_or_url, headers={"User-Agent": "BlueArchiveResearch/1.0"})
        with urlopen(request, timeout=60) as response:
            return json.load(response)
    with open(path_or_url, encoding="utf-8") as handle:
        return json.load(handle)


def _group_items(groups: dict, group_id: int | str) -> list[dict]:
    try:
        return groups[str(group_id)]
    except KeyError as exc:
        raise ValueError(f"crafting group {group_id} is missing") from exc


def score_node(node: dict, groups: dict, student_values: dict[int, float]) -> dict[str, float]:
    """Return EXP, gift quantity, and zero-EXP probability for one node.

    Rewards that are not a gift item in the relationship snapshot are discarded
    for this simulator: they contribute zero relationship EXP and zero gift
    quantity, regardless of their in-game quantity.
    """
    node_weight_total = sum(group["Weight"] for group in node["Groups"])
    if node_weight_total <= 0:
        raise ValueError(f"node {node.get('Id')} has no positive group weight")

    expected_exp = 0.0
    expected_gift_quantity = 0.0
    no_positive_relationship_probability = 0.0
    for node_group in node["Groups"]:
        items = _group_items(groups, node_group["GroupId"])
        item_weight_total = sum(item["Weight"] for item in items)
        if item_weight_total <= 0:
            raise ValueError(f"group {node_group['GroupId']} has no positive item weight")
        group_probability = node_group["Weight"] / node_weight_total
        for item in items:
            item_probability = group_probability * item["Weight"] / item_weight_total
            is_gift_reward = (
                item.get("Type") == "Item" and item.get("ItemId") in student_values
            )
            if not is_gift_reward or student_values[item["ItemId"]] <= 0:
                no_positive_relationship_probability += item_probability
                continue
            expected_amount = (item["AmountMin"] + item["AmountMax"]) / 2
            expected_gift_quantity += item_probability * expected_amount
            expected_exp += (
                item_probability
                * expected_amount
                * student_values[item["ItemId"]]
            )
    return {
        "expected_relationship_exp": expected_exp,
        "expected_gift_quantity": expected_gift_quantity,
        "no_positive_relationship_probability": no_positive_relationship_probability,
    }


def expected_node_relationship_exp(
    node: dict, groups: dict, student_values: dict[int, float]
) -> float:
    return score_node(node, groups, student_values)["expected_relationship_exp"]


def score_stage(
    nodes: list[dict],
    groups: dict,
    student_values: dict[int, float],
    option_count: int = NODE_OPTION_COUNT,
) -> dict[str, float]:
    """Score the best of the randomly displayed node options.

    The game displays five random node options and the player chooses one.
    SchaleDB's node Weight is used for each independent option draw.  A node
    can therefore be absent from all five options; this is represented by the
    probability that the maximum score is zero.
    """
    if not isinstance(option_count, int) or option_count <= 0:
        raise ValueError("option_count must be a positive integer")
    node_weight_total = sum(node["Weight"] for node in nodes)
    if node_weight_total <= 0:
        raise ValueError("every manufacturing stage must have positive node weight")

    score_groups: dict[float, dict[str, float]] = {}
    for node in nodes:
        node_probability = node["Weight"] / node_weight_total
        score = score_node(node, groups, student_values)
        score_key = round(score["expected_relationship_exp"], 12)
        group = score_groups.setdefault(
            score_key,
            {
                "probability": 0.0,
                "quantity_weighted": 0.0,
                "no_positive_probability_weighted": 0.0,
            },
        )
        group["probability"] += node_probability
        group["quantity_weighted"] += (
            node_probability * score["expected_gift_quantity"]
        )
        group["no_positive_probability_weighted"] += (
            node_probability * score["no_positive_relationship_probability"]
        )

    expected_exp = 0.0
    expected_gift_quantity = 0.0
    cumulative_probability = 0.0
    no_positive_relationship_probability = 0.0
    for score_value in sorted(score_groups):
        group = score_groups[score_value]
        next_cumulative_probability = cumulative_probability + group["probability"]
        max_score_probability = (
            next_cumulative_probability**option_count
            - cumulative_probability**option_count
        )
        expected_exp += max_score_probability * score_value
        if group["probability"] > 0:
            expected_gift_quantity += max_score_probability * (
                group["quantity_weighted"] / group["probability"]
            )
            no_positive_relationship_probability += max_score_probability * (
                group["no_positive_probability_weighted"] / group["probability"]
            )
        cumulative_probability = next_cumulative_probability

    return {
        "expected_relationship_exp": expected_exp,
        "expected_gift_quantity": expected_gift_quantity,
        "no_positive_relationship_probability": no_positive_relationship_probability,
    }


def expected_stage_relationship_exp(
    nodes: list[dict],
    groups: dict,
    student_values: dict[int, float],
    option_count: int = NODE_OPTION_COUNT,
) -> float:
    return score_stage(
        nodes, groups, student_values, option_count
    )["expected_relationship_exp"]


def gift_items_for_node(
    node: dict, groups: dict, gift_by_id: dict[int, dict]
) -> list[dict]:
    gift_ids = {
        item["ItemId"]
        for node_group in node["Groups"]
        for item in _group_items(groups, node_group["GroupId"])
        if item.get("Type") == "Item" and item.get("ItemId") in gift_by_id
    }
    return [
        {
            "gift_id": gift_id,
            "name_en": gift_by_id[gift_id]["name_en"],
            "name_zh_cn": gift_by_id[gift_id]["name_zh_cn"],
        }
        for gift_id in sorted(gift_ids)
    ]


def calculate_student(
    student: dict,
    nodes: list[dict],
    groups: dict,
    gift_by_id: dict[int, dict] | None = None,
) -> dict:
    gift_by_id = gift_by_id or {}
    student_values = {
        value["gift_id"]: value["relationship_exp"]
        for value in student["gift_values"]
    }
    stage_expected_exp = {}
    stage_expected_gift_quantity = {}
    stage_no_positive_relationship_probability = {}
    stage_node_count = {}
    stage_node_expectations = {}

    for stage in ("1", "2", "3"):
        stage_nodes = [node for node in nodes if str(node["Tier"]) == stage]
        stage_node_count[stage] = len(stage_nodes)
        stage_weight_total = sum(node["Weight"] for node in stage_nodes)
        node_expectations = []
        for node in stage_nodes:
            node_score = score_node(node, groups, student_values)
            node_expectations.append(
                {
                    "node_id": node["Id"],
                    "name_en": node["NameEn"],
                    "name_zh_cn": node.get("NameCn", ""),
                    "gift_names_en": [
                        gift["name_en"]
                        for gift in gift_items_for_node(node, groups, gift_by_id)
                    ],
                    "gift_names_zh_cn": [
                        gift["name_zh_cn"]
                        for gift in gift_items_for_node(node, groups, gift_by_id)
                    ],
                    "probability": round(node["Weight"] / stage_weight_total, 9),
                    "expected_relationship_exp": round(
                        node_score["expected_relationship_exp"], 6
                    ),
                    "expected_gift_quantity": round(
                        node_score["expected_gift_quantity"], 6
                    ),
                    "no_positive_relationship_probability": round(
                        node_score["no_positive_relationship_probability"], 6
                    ),
                }
            )
        stage_node_expectations[stage] = sorted(
            node_expectations,
            key=lambda item: (
                -item["expected_relationship_exp"],
                -item["expected_gift_quantity"],
                item["node_id"],
            ),
        )
        score = score_stage(stage_nodes, groups, student_values)
        stage_expected_exp[stage] = round(score["expected_relationship_exp"], 6)
        stage_expected_gift_quantity[stage] = round(
            score["expected_gift_quantity"], 6
        )
        stage_no_positive_relationship_probability[stage] = round(
            score["no_positive_relationship_probability"], 6
        )

    total_exp = round(sum(stage_expected_exp.values()), 6)
    return {
        "student_id": student["student_id"],
        "name_en": student["name_en"],
        "name_zh_cn": student["name_zh_cn"],
        "stage_node_count": stage_node_count,
        "stage_node_expectations": stage_node_expectations,
        "stage_expected_relationship_exp": stage_expected_exp,
        "stage_expected_gift_quantity": stage_expected_gift_quantity,
        "stage_no_positive_relationship_probability": stage_no_positive_relationship_probability,
        "full_three_stage_expected_relationship_exp": total_exp,
        "manufacturing_stone_cost": sum(STAGE_STONE_COSTS.values()),
        "relationship_exp_per_manufacturing_stone": total_exp,
    }


def build_snapshot(
    students: list[dict],
    crafting: dict,
    source: dict,
    retrieved_at: str,
    gifts: list[dict] | None = None,
) -> dict:
    groups = crafting["Groups"]
    gift_by_id = {gift["id"]: gift for gift in (gifts or [])}
    results = [
        calculate_student(student, crafting["Nodes"], groups, gift_by_id)
        for student in students
    ]
    stage_totals = {
        str(stage): {
            "node_count": sum(node["Tier"] == stage for node in crafting["Nodes"]),
            "total_weight": crafting["TotalWeight"][stage - 1],
        }
        for stage in (1, 2, 3)
    }
    node_distributions = {}
    gift_item_ids = {
        value["gift_id"]
        for student in students
        for value in student["gift_values"]
    }
    gift_capable_nodes_by_stage = {}
    gift_capable_node_names_by_stage = {}
    for stage in (1, 2, 3):
        stage_nodes = [node for node in crafting["Nodes"] if node["Tier"] == stage]
        stage_weight = sum(node["Weight"] for node in stage_nodes)
        node_distributions[str(stage)] = [
            {
                "id": node["Id"],
                "name_en": node["NameEn"],
                "name_zh_cn": node.get("NameCn", ""),
                "weight": node["Weight"],
                "probability": round(node["Weight"] / stage_weight, 9),
            }
            for node in sorted(stage_nodes, key=lambda item: item["Id"])
        ]
        gift_nodes = [
            node
            for node in sorted(stage_nodes, key=lambda item: item["Id"])
            if any(
                item.get("Type") == "Item" and item.get("ItemId") in gift_item_ids
                for node_group in node["Groups"]
                for item in _group_items(crafting["Groups"], node_group["GroupId"])
            )
        ]
        gift_capable_nodes_by_stage[str(stage)] = [node["Id"] for node in gift_nodes]
        gift_capable_node_names_by_stage[str(stage)] = [
            {
                "id": node["Id"],
                "name_en": node["NameEn"],
                "name_zh_cn": node.get("NameCn", ""),
            }
            for node in gift_nodes
        ]
    return {
        "schema_version": 3,
        "scope": {
            "server": "cn",
            "language": "bilingual",
            "languages": {"en": "en", "zh_cn": "cn"},
            "student_count": len(results),
            "fragment_equivalent": FRAGMENT_EQUIVALENT,
            "stage_stone_costs": STAGE_STONE_COSTS,
            "manufacturing_stone_cost": 1,
            "other_materials_costed": False,
            "node_option_count": NODE_OPTION_COUNT,
            "node_selection_policy": "show five independent node options per stage; choose the highest expected relationship value",
            "node_probability_policy": "node.Weight is applied independently to each displayed option before choosing the maximum",
            "non_gift_output_policy": NON_GIFT_OUTPUT_POLICY,
        },
        "source": {
            "retrieved_at": retrieved_at,
            "crafting_source": source["crafting_source"],
            "crafting_page": CRAFTING_PAGE_URL,
            "crafting_mechanism_source": CRAFTING_MECHANISM_SOURCE_URL,
            "stage_cost_source": STAGE_COST_SOURCE_URL,
            "relationship_snapshot": source["relationship_snapshot"],
        },
        "crafting_probability": {
            "stage_totals": stage_totals,
            "node_distributions": node_distributions,
            "gift_capable_nodes_by_stage": gift_capable_nodes_by_stage,
            "gift_capable_node_names_by_stage": gift_capable_node_names_by_stage,
            "node_probability_formula": "node.Weight / TotalWeight[tier - 1]",
            "group_probability_formula": "group.Weight / sum(node.Groups.Weight)",
            "item_probability_formula": "item.Weight / sum(group.items.Weight)",
            "amount_expectation_formula": "(AmountMin + AmountMax) / 2",
            "node_no_positive_relationship_probability_formula": "non-gift rewards are discarded as zero; sum node/group/item probability for rewards that do not produce positive relationship EXP",
            "stage_expectation_formula": "sum((CDF(score)^5 - CDF(previous_score)^5) * score)",
        },
        "students": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--crafting-cn", default=CRAFTING_CN_URL)
    parser.add_argument(
        "--relationship-data-dir", type=Path, default=Path(__file__).parent
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    relationship_dir = args.relationship_data_dir
    students_snapshot_path = relationship_dir / "student_gift_preferences.json"
    with students_snapshot_path.open(encoding="utf-8") as handle:
        students = json.load(handle)
    gifts_snapshot_path = relationship_dir / "gifts.json"
    with gifts_snapshot_path.open(encoding="utf-8") as handle:
        gifts = json.load(handle)
    crafting = read_json(args.crafting_cn)
    retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    source = {
        # Keep the published source URL in the snapshot even when a local
        # downloaded copy is supplied for a reproducible offline rebuild.
        "crafting_source": (
            args.crafting_cn
            if args.crafting_cn.startswith("http")
            else CRAFTING_CN_URL
        ),
        "relationship_snapshot": "student_gift_preferences.json",
    }
    output_path = args.output or relationship_dir / "crafting_expected_relationship.json"
    output_path.write_text(
        json.dumps(
            build_snapshot(
                students["students"], crafting, source, retrieved_at, gifts["gifts"]
            ),
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
