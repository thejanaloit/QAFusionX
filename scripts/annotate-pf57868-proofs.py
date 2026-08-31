#!/usr/bin/env python3
"""Draw red issue boxes + labels on PF-57868 proof PNGs (1520x960)."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SRC = Path(r"C:\Users\ThejanaD\QAFusionX\proof-2round-complete-aug31")
OUT = Path(r"C:\Users\ThejanaD\QAFusionX\proof-2round-annotated-aug31")
MIRROR = Path(r"E:\QAFusionX\workspaces\PF-57868\reports\proof\2round-annotated-aug31")
ATTACH = Path(r"E:\QAFusionX\workspaces\PF-57868\jira\attachments")

W, H = 1520, 960
OUT.mkdir(parents=True, exist_ok=True)
MIRROR.mkdir(parents=True, exist_ok=True)

try:
    FONT = ImageFont.truetype("arial.ttf", 18)
    FONT_SM = ImageFont.truetype("arialbd.ttf", 16)
except Exception:
    FONT = ImageFont.load_default()
    FONT_SM = FONT


def box(draw: ImageDraw.ImageDraw, xy, label: str, color=(220, 20, 60), width=4):
    x1, y1, x2, y2 = xy
    for i in range(width):
        draw.rectangle([x1 + i, y1 + i, x2 - i, y2 - i], outline=color)
    # label background
    pad = 6
    tw = draw.textlength(label, font=FONT_SM) if hasattr(draw, "textlength") else len(label) * 9
    th = 22
    ly = max(8, y1 - th - 4)
    draw.rectangle([x1, ly, x1 + tw + pad * 2, ly + th], fill=color)
    draw.text((x1 + pad, ly + 2), label, fill=(255, 255, 255), font=FONT_SM)


# relative helpers (fractions of W/H)
def R(x1, y1, x2, y2):
    return (int(x1 * W), int(y1 * H), int(x2 * W), int(y2 * H))


# filename pattern -> list of (box_frac, label, bug)
RULES: list[tuple[str, list[tuple[tuple, str, str]]]] = [
    # 58374 grace / view not detail
    ("*-74-view.png", [(R(0.22, 0.28, 0.98, 0.88), "ISSUE: View is Pending list — no instalment-wise grace fields (PF-58496)", "PF-58496")]),
    ("*-74-edit.png", [(R(0.22, 0.28, 0.98, 0.88), "ISSUE: Edit/detail missing grace period fields (PF-58496)", "PF-58496")]),
    ("*-74-tpl-*.png", [(R(0.22, 0.20, 0.98, 0.90), "ISSUE: Template spelling / settings (PF-58511)", "PF-58511")]),
    # 58375 offer blank / missing stepper
    ("*-75-offer.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Print Offer Letter UI blank / stepper missing (PF-58500)", "PF-58500")]),
    ("*-75-contract.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Contract/template path incomplete (PF-58499)", "PF-58499")]),
    ("*-75-rto*.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Joint/Business RTO templates missing (PF-58500)", "PF-58500")]),
    ("*-75-inq*.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Offer/inquiry content incomplete", "PF-58500")]),
    # 58376 schedule
    ("*-76-search-*.png", [
        (R(0.28, 0.22, 0.72, 0.42), "ISSUE: To Date / Schedule Name validation (PF-58425)", "PF-58425"),
        (R(0.22, 0.48, 0.98, 0.82), "ISSUE: Schedule search → No Data (PF-58418/58426)", "PF-58418"),
    ]),
    ("*-76-process.png", [(R(0.22, 0.30, 0.98, 0.85), "ISSUE: Process schedule empty / No Data (PF-58418)", "PF-58418")]),
    ("*-76-main.png", [(R(0.22, 0.20, 0.98, 0.88), "ISSUE: Schedule Monitory Dashboard — no usable results (PF-58418)", "PF-58418")]),
    # 58377 supplier
    ("*-77-entity-creation.png", [(R(0.05, 0.05, 0.95, 0.92), "ISSUE: Entity Creation blank / CSS+content fail (PF-58512)", "PF-58512")]),
    ("*-77-supplier-creation.png", [(R(0.05, 0.05, 0.95, 0.92), "ISSUE: Supplier Creation blank shell (PF-58512)", "PF-58512")]),
    ("*-77-create.png", [(R(0.05, 0.05, 0.95, 0.92), "ISSUE: Create page blank / broken layout", "PF-58512")]),
    ("*-77-indiv.png", [(R(0.05, 0.05, 0.95, 0.92), "ISSUE: Individual create blank", "PF-58512")]),
    ("*-77-list.png", [(R(0.05, 0.05, 0.95, 0.92), "ISSUE: List/create shell broken", "PF-58512")]),
    ("*-77-reports.png", [(R(0.22, 0.15, 0.98, 0.90), "ISSUE: Reports empty / no data", "PF-58512")]),
    ("*-77-pend*.png", [
        (R(0.22, 0.38, 0.98, 0.62), "ISSUE: Duplicate SUP0000002558 x3 (PF-58513)", "PF-58513"),
        (R(0.35, 0.38, 0.62, 0.78), "ISSUE: Entity Name / NIC blank dashes", "PF-58513"),
    ]),
    ("*-77-pending-supplier-confirmation.png", [
        (R(0.22, 0.38, 0.98, 0.62), "ISSUE: Duplicate SUP0000002558 x3 (PF-58513)", "PF-58513"),
        (R(0.35, 0.38, 0.62, 0.78), "ISSUE: Entity Name / NIC blank dashes", "PF-58513"),
    ]),
    # 58378 NCD value date
    ("*-78-view.png", [(R(0.22, 0.28, 0.55, 0.42), "ISSUE: Value Date = '-' (PF-58514)", "PF-58514")]),
    ("*-78-auth*.png", [(R(0.22, 0.20, 0.98, 0.88), "ISSUE: Maker cannot complete checker authorize (PF-58560)", "PF-58560")]),
    # 58380
    ("*-80-inq-*.png", [(R(0.22, 0.15, 0.98, 0.90), "ISSUE: Inquiry account/loan hit=false — no match", "PF-58438")]),
    ("*-80-rev*.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Reversal list empty / route blank (migrated receipt)", "PF-58438")]),
    ("*-80-realloc.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Reallocation empty", "PF-58438")]),
    ("*-80-maint.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Maintenance empty", "PF-58438")]),
    ("*-80-txn.png", [(R(0.22, 0.12, 0.98, 0.90), "ISSUE: Transaction list empty", "PF-58438")]),
    # 58383 GBAF trap
    ("*-83-account-management-*.png", [(R(0.22, 0.18, 0.78, 0.78), "ISSUE: GBAF/IBAF selector traps deep route (PF-58398/58416)", "PF-58398")]),
    ("*-83-retry-*.png", [(R(0.22, 0.18, 0.78, 0.78), "ISSUE: Retry still stuck on Banking Type selector (PF-58416)", "PF-58416")]),
    ("*-83-cNwNb-*.png", [(R(0.22, 0.18, 0.78, 0.78), "ISSUE: Account inquiry blocked by selector (PF-58398)", "PF-58398")]),
    ("*-83-maintenance-*.png", [(R(0.22, 0.18, 0.78, 0.78), "ISSUE: Ownership transfer blocked by selector", "PF-58398")]),
    ("*-83-gbaf.png", [(R(0.22, 0.18, 0.78, 0.78), "ISSUE: GBAF selector gate (PF-58398)", "PF-58398")]),
    # checker still maker
    ("chk-*.png", [(R(0.72, 0.02, 0.99, 0.12), "ISSUE: Still maker ThejanaD — MethmiB switch failed (PF-58560)", "PF-58560")]),
    # N/A kenya
    ("*-na-*.png", [(R(0.22, 0.15, 0.98, 0.88), "N/A Kenya: feature not on this UAT build", "N/A")]),
]


def match_rules(name: str):
    import fnmatch

    hits = []
    for pat, boxes in RULES:
        if fnmatch.fnmatch(name, pat):
            hits.extend(boxes)
    return hits


def annotate_one(path: Path) -> Path | None:
    rules = match_rules(path.name)
    if not rules:
        return None
    im = Image.open(path).convert("RGBA")
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    bugs = []
    for (xy, label, bug), i in zip(rules, range(len(rules))):
        # semi-transparent fill
        x1, y1, x2, y2 = xy
        draw.rectangle([x1, y1, x2, y2], fill=(220, 20, 60, 40))
        box(ImageDraw.Draw(overlay), xy, f"{i+1}. {label}"[:110], color=(200, 16, 46))
        bugs.append(bug)
    out = Image.alpha_composite(im, overlay).convert("RGB")
    # banner
    d2 = ImageDraw.Draw(out)
    banner = f"ANNOTATED ISSUE PROOF | {path.name} | bugs={','.join(sorted(set(bugs)))}"
    d2.rectangle([0, H - 28, W, H], fill=(30, 30, 30))
    d2.text((10, H - 24), banner[:140], fill=(255, 220, 220), font=FONT_SM)
    dest = OUT / f"ANN-{path.name}"
    out.save(dest, quality=92)
    shutil.copy2(dest, MIRROR / dest.name)
    return dest


def package_attachments(annotated: list[Path]):
    # map bug -> annotated files
    bug_map: dict[str, list[Path]] = {}
    for p in annotated:
        # parse bugs from filename rules again
        for _xy, _lab, bug in match_rules(p.name.replace("ANN-", "")):
            if bug == "N/A":
                continue
            bug_map.setdefault(bug, []).append(p)
    for bug, files in bug_map.items():
        d = ATTACH / bug
        d.mkdir(parents=True, exist_ok=True)
        for f in files[:6]:
            shutil.copy2(f, d / f.name)


def main():
    annotated = []
    for png in sorted(SRC.glob("*.png")):
        r = annotate_one(png)
        if r:
            annotated.append(r)
    package_attachments(annotated)
    manifest = {
        "source": str(SRC),
        "out": str(OUT),
        "mirror": str(MIRROR),
        "count": len(annotated),
        "files": [p.name for p in annotated],
    }
    (OUT / "_annotate-manifest.json").write_text(json.dumps(manifest, indent=2))
    (MIRROR / "_annotate-manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps({"annotated": len(annotated), "out": str(OUT)}, indent=2))


if __name__ == "__main__":
    main()
