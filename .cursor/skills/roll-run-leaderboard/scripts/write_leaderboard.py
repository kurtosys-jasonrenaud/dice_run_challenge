#!/usr/bin/env python3
"""Rank extracted run entries and write leaderboard files.

OCR is performed by the agent. This script only formats and ranks results.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
LEADERBOARD = ROOT / "leaderboard"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", required=True, help="Challenge day YYYY-MM-DD")
    parser.add_argument(
        "--input",
        required=True,
        help="Path to JSON with entries and optional unparsed list",
    )
    parser.add_argument(
        "--target-km",
        type=float,
        default=None,
        help="Override challenge target distance in km",
    )
    return parser.parse_args()


def load_target(day: str, override: float | None) -> float | None:
    if override is not None:
        return override
    targets_path = LEADERBOARD / "challenge-targets.json"
    if not targets_path.exists():
        return None
    targets = json.loads(targets_path.read_text(encoding="utf-8"))
    value = targets.get(day)
    return float(value) if value is not None else None


def rank_entries(entries: list[dict], target: float | None) -> list[dict]:
    def sort_key(entry: dict) -> tuple:
        distance = float(entry.get("distanceKm") or 0)
        met = bool(target is not None and distance >= target)
        return (0 if met else 1, -distance, entry.get("runner") or "")

    ranked = sorted(entries, key=sort_key)
    for index, entry in enumerate(ranked, start=1):
        entry["rank"] = index
        distance = float(entry.get("distanceKm") or 0)
        entry["metTarget"] = bool(target is not None and distance >= target)
    return ranked


def to_markdown(day: str, target: float | None, entries: list[dict], unparsed: list[dict]) -> str:
    label = f"{target:g} km" if target is not None else "Not set"
    lines = [
        f"# Roll & Run Leaderboard · {day}",
        "",
        f"Challenge target: **{label}**",
        "",
        "| Rank | Runner | Distance | Time | Target |",
        "| --- | --- | --- | --- | --- |",
    ]
    if not entries:
        lines.append("| - | - | - | - | No completed runs |")
    for entry in entries:
        target_label = (
            "Met"
            if entry.get("metTarget")
            else "Missed"
            if target is not None
            else "-"
        )
        lines.append(
            "| {rank} | {runner} | {distance} km | {time} | {target} |".format(
                rank=entry.get("rank", "-"),
                runner=entry.get("runner") or "Unknown",
                distance=entry.get("distanceKm")
                if entry.get("distanceKm") is not None
                else "-",
                time=entry.get("movingTime") or "-",
                target=target_label,
            )
        )

    lines.extend(["", "## Needs review"])
    if not unparsed:
        lines.append("- None")
    else:
        for item in unparsed:
            lines.append(f"- {item['sourceFile']}: {item['error']}")

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    LEADERBOARD.mkdir(parents=True, exist_ok=True)

    payload_in = json.loads(Path(args.input).read_text(encoding="utf-8"))
    entries = payload_in.get("entries") or []
    unparsed = payload_in.get("unparsed") or []
    target = load_target(args.date, args.target_km)
    if payload_in.get("challengeTargetKm") is not None and args.target_km is None:
        target = float(payload_in["challengeTargetKm"])

    ranked = rank_entries(entries, target)
    payload = {
        "date": args.date,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "challengeTargetKm": target,
        "challengeLabel": f"{target:g} km" if target is not None else None,
        "entries": ranked,
        "unparsed": unparsed,
    }

    json_path = LEADERBOARD / f"{args.date}.json"
    md_path = LEADERBOARD / f"{args.date}.md"
    latest_path = LEADERBOARD / "latest.md"
    markdown = to_markdown(args.date, target, ranked, unparsed)

    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown, encoding="utf-8")
    latest_path.write_text(markdown, encoding="utf-8")

    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"Wrote {latest_path}")
    print(f"Ranked {len(ranked)} · needs review {len(unparsed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
