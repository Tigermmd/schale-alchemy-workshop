#!/usr/bin/env python3
"""Download the SchaleDB images used by the relationship dashboard.

The generated manifest keeps the public source URL beside each local cache path,
so the page can fall back to SchaleDB when a local asset is unavailable.
"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = "https://schaledb.com"
CRAFTING_URL = "https://schaledb.com/data/crafting.min.json"
USER_AGENT = "BlueArchiveRelationshipDashboard/1.0"
REACTION_ICON_SPECS = [
    (
        f"reaction:{grade}",
        f"./assets/reactions/gift-0{grade}.png",
        f"{BASE_URL}/images/ui/Cafe_Interaction_Gift_0{grade}.png",
    )
    for grade in range(1, 5)
]

# Secondary assets are kept separate from the compact icons already used in
# lists.  The collection portraits are used only in the selected-student
# detail/hero surfaces, so the list view stays fast while the detail view can
# feel like an in-game profile instead of a plain admin card.
UI_ASSET_SPECS = [
    (
        "ui:schaledb-logo",
        "./assets/ui/schaledb-logo.svg",
        f"{BASE_URL}/images/logo_schaledb.svg",
    ),
    (
        "ui:schaledb-logo-small",
        "./assets/ui/schaledb-logo-small.svg",
        f"{BASE_URL}/images/logo_small.svg",
    ),
    (
        "ui:craft-node-border",
        "./assets/ui/craft-node-border.png",
        f"{BASE_URL}/images/craftnode/Node_Border.png",
    ),
    (
        "ui:momotalk",
        "./assets/ui/momotalk.png",
        f"{BASE_URL}/images/ui/Icon_MomoTalk.png",
    ),
    (
        "ui:momotalk-compact",
        "./assets/ui/momotalk-compact.png",
        f"{BASE_URL}/images/ui/Icon_MomoTalk2.png",
    ),
    (
        "ui:schedule-favor",
        "./assets/ui/schedule-favor.png",
        f"{BASE_URL}/images/ui/School_Icon_Schedule_Favor.png",
    ),
    (
        "ui:momotalk-font",
        "./assets/ui/momotalk-font.png",
        f"{BASE_URL}/images/ui/ImgFont_Momotalk.png",
    ),
    (
        "ui:arona-error",
        "./assets/ui/arona-error.png",
        f"{BASE_URL}/images/ui/arona_error.png",
    ),
    (
        "ui:arona-loading-bg",
        "./assets/ui/arona-loading-bg.png",
        "https://arona.icu/assets/loading_bg_pc.ba246778-ba246778.png",
    ),
    (
        "ui:arona-avatar-1",
        "./assets/ui/arona-avatar-1.png",
        "https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar1.c18ce793.png",
    ),
    (
        "ui:arona-avatar-2",
        "./assets/ui/arona-avatar-2.png",
        "https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar2.916294c1.png",
    ),
    (
        "ui:arona-avatar-3",
        "./assets/ui/arona-avatar-3.png",
        "https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar3.5e643647.png",
    ),
    (
        "ui:arona-avatar-4",
        "./assets/ui/arona-avatar-4.png",
        "https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/avatar4.be61bf91.png",
    ),
    # These are used as small visual anchors in the resource, package and
    # agent workspaces. They are deliberately local and optional so the app
    # remains usable when a third-party asset host is unavailable.
    (
        "ui:arona-title-new",
        "./assets/ui/arona-title-new.webp",
        "https://arona.icu/arona_title_new.webp",
    ),
    (
        "ui:kivo-home-button",
        "./assets/ui/kivo-home-button.webp",
        "https://kivo.wiki/assets/home_button-BRCngEW_.webp",
    ),
    (
        "ui:kivo-favor",
        "./assets/ui/kivo-favor.webp",
        "https://kivo.wiki/assets/favor-BK4Xpa_s.webp",
    ),
    (
        "ui:kivo-options",
        "./assets/ui/kivo-options.webp",
        "https://kivo.wiki/assets/options-DoCj5sFX.webp",
    ),
    (
        "ui:kivo-empty",
        "./assets/ui/kivo-empty.webp",
        "https://kivo.wiki/assets/empty-V3buqWTa.webp",
    ),
    (
        "ui:kivo-default-half-body",
        "./assets/ui/kivo-default-half-body.webp",
        "https://kivo.wiki/assets/default-half_body-anmscmGj.webp",
    ),
    (
        "ui:kivo-default-avatar",
        "./assets/ui/kivo-default-avatar.webp",
        "https://kivo.wiki/assets/default_avatar-DsP7GJoc.webp",
    ),
    (
        "ui:kivo-logo",
        "./assets/ui/kivo-logo.svg",
        "https://kivo.wiki/assets/logo-Br8CpJHI.svg",
    ),
    (
        "ui:kivo-loading",
        "./assets/ui/kivo-loading.gif",
        "https://kivo.wiki/load.gif",
    ),
    (
        "ui:arona-favicon",
        "./assets/ui/arona.jpg",
        "https://arona.icu/arona.jpg",
    ),
    (
        "ui:schaledb-gdd-full",
        "./assets/ui/schaledb-gdd-full.png",
        "https://schaledb.com/images/ui/pixel/GDD_Full.png",
    ),
    (
        "ui:schaledb-gdd-logo",
        "./assets/ui/schaledb-gdd-logo.png",
        "https://schaledb.com/images/ui/pixel/GDD_Logo.png",
    ),
    (
        "ui:schaledb-logo-dark",
        "./assets/ui/schaledb-logo-dark.png",
        "https://schaledb.com/logo-dark.png",
    ),
    # Small, game-like state markers from KivoWiki. They are used as a
    # visual key for reaction/empty states, never as a replacement for the
    # official SchaleDB gift reaction values.
    (
        "ui:kivo-reaction-a",
        "./assets/ui/kivo-reaction-a.webp",
        "https://kivo.wiki/assets/A-CEklTVgE.webp",
    ),
    (
        "ui:kivo-reaction-b",
        "./assets/ui/kivo-reaction-b.webp",
        "https://kivo.wiki/assets/B-CSvihKot.webp",
    ),
    (
        "ui:kivo-reaction-c",
        "./assets/ui/kivo-reaction-c.webp",
        "https://kivo.wiki/assets/C-BhTrONJU.webp",
    ),
    (
        "ui:kivo-reaction-d",
        "./assets/ui/kivo-reaction-d.webp",
        "https://kivo.wiki/assets/D-CS4HgjoS.webp",
    ),
    (
        "ui:kivo-reaction-s",
        "./assets/ui/kivo-reaction-s.webp",
        "https://kivo.wiki/assets/S-DHjdbk-G.webp",
    ),
    (
        "ui:kivo-reaction-ss",
        "./assets/ui/kivo-reaction-ss.webp",
        "https://kivo.wiki/assets/SS-RrLftTEI.webp",
    ),
    # SchaleDB's native rarity tiles keep gift cards recognizable without
    # adding another large illustration or inventing a new visual language.
    (
        "ui:schaledb-rarity-n",
        "./assets/ui/pixel/BG_N.png",
        "https://schaledb.com/images/ui/pixel/BG_N.png",
    ),
    (
        "ui:schaledb-rarity-r",
        "./assets/ui/pixel/BG_R.png",
        "https://schaledb.com/images/ui/pixel/BG_R.png",
    ),
    (
        "ui:schaledb-rarity-sr",
        "./assets/ui/pixel/BG_SR.png",
        "https://schaledb.com/images/ui/pixel/BG_SR.png",
    ),
    (
        "ui:schaledb-rarity-ssr",
        "./assets/ui/pixel/BG_SSR.png",
        "https://schaledb.com/images/ui/pixel/BG_SSR.png",
    ),
    (
        "ui:schaledb-type-tile",
        "./assets/ui/pixel/Background_Type.png",
        "https://schaledb.com/images/ui/pixel/Background_Type.png",
    ),
    # Pixel backgrounds from SchaleDB.  These are used as low-opacity page
    # textures and section markers, so the data remains the visual focus.
    (
        "ui:schaledb-pixel-skill-normal",
        "./assets/ui/pixel/Background_Skill_Normal.png",
        "https://schaledb.com/images/ui/pixel/Background_Skill_Normal.png",
    ),
    (
        "ui:schaledb-pixel-skill-explosion",
        "./assets/ui/pixel/Background_Skill_Explosion.png",
        "https://schaledb.com/images/ui/pixel/Background_Skill_Explosion.png",
    ),
    (
        "ui:schaledb-pixel-skill-pierce",
        "./assets/ui/pixel/Background_Skill_Pierce.png",
        "https://schaledb.com/images/ui/pixel/Background_Skill_Pierce.png",
    ),
    (
        "ui:schaledb-pixel-skill-mystic",
        "./assets/ui/pixel/Background_Skill_Mystic.png",
        "https://schaledb.com/images/ui/pixel/Background_Skill_Mystic.png",
    ),
    (
        "ui:schaledb-pixel-skill-sonic",
        "./assets/ui/pixel/Background_Skill_Sonic.png",
        "https://schaledb.com/images/ui/pixel/Background_Skill_Sonic.png",
    ),
    (
        "ui:schaledb-pixel-skill-chemical",
        "./assets/ui/pixel/Background_Skill_Chemical.png",
        "https://schaledb.com/images/ui/pixel/Background_Skill_Chemical.png",
    ),
    (
        "ui:schaledb-pixel-slider",
        "./assets/ui/pixel/slider.png",
        "https://schaledb.com/images/ui/pixel/slider.png",
    ),
    (
        "ui:schaledb-enemy-elite",
        "./assets/ui/Common_Icon_Enemy_Elite.png",
        "https://schaledb.com/images/ui/Common_Icon_Enemy_Elite.png",
    ),
    (
        "ui:schaledb-enemy-champion",
        "./assets/ui/Common_Icon_Enemy_Champion.png",
        "https://schaledb.com/images/ui/Common_Icon_Enemy_Champion.png",
    ),
]

# Official SchaleDB stage illustrations give each workspace a small sense of
# place.  Each area has a second, alternate crop that can be used as a
# low-contrast texture without making the page repeat the same banner.
STAGE_ART_SPECS = [
    spec
    for area in range(1, 7)
    for variant, label in ((0, "normal"), (1, "alternate"))
    for spec in [
        (
            f"ui:stage-mission-{area}-{label}",
            f"./assets/ui/stages/mission_{area}_{variant}.webp",
            f"{BASE_URL}/images/stage/mission_{area}_{variant}.webp",
        )
    ]
]

# Future-planning entries are not part of the released-student preference
# snapshot, but their portraits are still useful when the planner is opened
# for a not-yet-released student.
EXTRA_PORTRAIT_STUDENT_IDS = (10122,)
EXTRA_COLLECTION_STUDENT_IDS = (10122,)


def read_json(path: Path | str) -> dict:
    if str(path).startswith("http"):
        request = Request(str(path), headers={"User-Agent": USER_AGENT})
        with urlopen(request, timeout=15) as response:
            return json.load(response)
    return json.loads(Path(path).read_text(encoding="utf-8"))


def download(url: str, destination: Path) -> bool:
    if destination.is_file() and destination.stat().st_size > 0:
        return True
    try:
        request = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(request, timeout=15) as response:
            content_type = response.headers.get_content_type()
            payload = response.read()
        if not payload or content_type == "text/html":
            return False
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
        return True
    except (HTTPError, URLError, TimeoutError, ValueError):
        return False


def download_asset(
    output_dir: Path,
    key: str,
    local_relative: str,
    remote: str,
) -> tuple[str, dict]:
    local_path = output_dir / local_relative.removeprefix("./")
    downloaded = download(remote, local_path)
    return key, {
        "local": local_relative,
        "remote": remote,
        "downloaded": downloaded,
        "bytes": local_path.stat().st_size if local_path.is_file() else 0,
    }


def build_manifest(data_dir: Path, output_dir: Path) -> dict:
    gifts = read_json(data_dir / "gifts.json")["gifts"]
    students = read_json(data_dir / "student_gift_preferences.json")["students"]
    crafting = read_json(CRAFTING_URL)
    specs: list[tuple[str, str, str]] = []

    for gift in gifts:
        specs.append(
            (
                f"gift:{gift['id']}",
                f"./assets/gifts/{gift['id']}.webp",
                f"{BASE_URL}/images/item/icon/{gift['icon']}.webp",
            )
        )
    for student in students:
        specs.append(
            (
                f"student:{student['student_id']}",
                f"./assets/students/{student['student_id']}.webp",
                f"{BASE_URL}/images/student/icon/{student['student_id']}.webp",
            )
        )
        specs.append(
            (
                f"student-collection:{student['student_id']}",
                f"./assets/students/collection/{student['student_id']}.webp",
                f"{BASE_URL}/images/student/collection/{student['student_id']}.webp",
            )
        )
        specs.append(
            (
                f"student-portrait:{student['student_id']}",
                f"./assets/students/portrait/{student['student_id']}.webp",
                f"{BASE_URL}/images/student/portrait/{student['student_id']}.webp",
            )
        )
    known_student_ids = {int(student["student_id"]) for student in students}
    for student_id in EXTRA_PORTRAIT_STUDENT_IDS:
        if student_id in known_student_ids:
            continue
        specs.append(
            (
                f"student-portrait:{student_id}",
                f"./assets/students/portrait/{student_id}.webp",
                f"{BASE_URL}/images/student/portrait/{student_id}.webp",
            )
        )
    for student_id in EXTRA_COLLECTION_STUDENT_IDS:
        if student_id in known_student_ids:
            continue
        specs.append(
            (
                f"student-collection:{student_id}",
                f"./assets/students/collection/{student_id}.webp",
                f"{BASE_URL}/images/student/collection/{student_id}.webp",
            )
        )
    for node in crafting.get("Nodes", []):
        icon = node.get("Icon")
        if not icon:
            continue
        specs.append(
            (
                f"node:{node['Id']}",
                f"./assets/nodes/{node['Id']}.png",
                f"{BASE_URL}/images/craftnode/{icon}.png",
            )
        )
    specs.extend(REACTION_ICON_SPECS)
    specs.extend(UI_ASSET_SPECS)
    specs.extend(STAGE_ART_SPECS)

    with ThreadPoolExecutor(max_workers=12) as executor:
        entries = dict(
            executor.map(
                lambda spec: download_asset(output_dir, *spec),
                specs,
            )
        )

    return {
        "schema_version": 1,
        "source": {
            "image_base": BASE_URL,
            "crafting_source": CRAFTING_URL,
            "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "entries": entries,
        "counts": {
            "gifts": len(gifts),
            "students": len(students),
            "student_collection_portraits": len(students) + sum(1 for student_id in EXTRA_COLLECTION_STUDENT_IDS if student_id not in known_student_ids),
            "student_portraits": len(students) + sum(1 for student_id in EXTRA_PORTRAIT_STUDENT_IDS if student_id not in known_student_ids),
            "crafting_nodes": len(crafting.get("Nodes", [])),
            "reaction_icons": len(REACTION_ICON_SPECS),
            "ui_assets": len(UI_ASSET_SPECS),
            "downloaded": sum(1 for entry in entries.values() if entry["downloaded"]),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).parent.parent / "relationship_data")
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent)
    args = parser.parse_args()
    manifest = build_manifest(args.data_dir, args.output_dir)
    manifest_path = args.output_dir / "assets" / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
