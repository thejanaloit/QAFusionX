#!/usr/bin/env python3
"""
PF-57868 Kenya UAT — Book1-style visual QA Excel
Columns: Area | Issue / Concern | Screenshot (real embedded images)
Built with xlsxwriter so images show in desktop Excel.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import xlsxwriter
from PIL import Image as PILImage

ANN = Path(r"C:\Users\ThejanaD\QAFusionX\proof-2round-annotated-aug31")
RAW = Path(r"C:\Users\ThejanaD\QAFusionX\proof-2round-complete-aug31")
CHK = Path(r"C:\Users\ThejanaD\QAFusionX\proof-checker-password-aug31")
DONE = Path(r"C:\Users\ThejanaD\QAFusionX\proof-done-push-aug31")
THUMB = Path(r"C:\Users\ThejanaD\QAFusionX\proof-2round-annotated-aug31\_xlsxwriter-thumbs")

ROWS: list[tuple[str, str, list[str]]] = [
    ("PF-58374 | PERC View",
     "Instalment-wise grace period fields missing on View / Pending detail (PF-58496). Story PARTIAL — product bug.",
     ["ANN-r2-74-view.png", "ANN-r1-74-view.png", "r2-74-view.png"]),
    ("PF-58374 | PERC Edit",
     "Edit/detail path does not expose grace tier fields (PF-58496 / PF-58497).",
     ["ANN-r2-74-edit.png", "r2-74-edit.png"]),
    ("PF-58374 | Template",
     "Penal interest templates / settings copy defects (INTREST etc.) — PF-58511.",
     ["ANN-r2-74-tpl-template.png", "r2-74-tpl-template.png"]),
    ("PF-58375 | Print Offer Letter",
     "Print Offer Letter UI blank / Loading spinner — Joint/Business RTO templates missing (PF-58500).",
     ["ANN-done-75-offer.png", "ANN-r2-75-offer.png", "r2-75-offer.png"]),
    ("PF-58375 | RTO Contract",
     "RTO contract / template path incomplete (PF-58499).",
     ["ANN-r2-75-contract.png", "r2-75-contract.png"]),
    ("PF-58375 | RTO Inquiry",
     "Rent-to-Own inquiry content incomplete / No Data.",
     ["ANN-r2-75-inq-rto.png", "r2-75-inq-rto.png"]),
    ("PF-58376 | Schedule Dashboard 404",
     "schedule-monitory-dashboard deep link returns HTTP 404 (PF-58418).",
     ["ANN-done-76-CASA-search.png", "76-CASA-search.png"]),
    ("PF-58376 | Schedule Search No Data",
     "After module/date filters, grid stays No Data — cannot verify Success+Error (PF-58418/25/26).",
     ["ANN-r2-76-search-CASA.png", "r2-76-search-CASA.png"]),
    ("PF-58376 | Schedule Process",
     "Process schedule empty / No Data.",
     ["ANN-r2-76-process.png", "r2-76-process.png"]),
    ("PF-58377 | Entity Creation blank",
     "Entity Creation page blank / broken CSS+content shell (PF-58512).",
     ["ANN-done-77-entity.png", "ANN-r2-77-entity-creation.png", "r2-77-entity-creation.png"]),
    ("PF-58377 | Supplier Creation blank",
     "Supplier Creation same blank shell.",
     ["ANN-r2-77-supplier-creation.png", "r2-77-supplier-creation.png"]),
    ("PF-58377 | Pending duplicates",
     "Pending Entity Confirmation: SUP0000002558 appears 3×; Name/NIC dashes (PF-58513).",
     ["ANN-r2-77-pending-supplier-confirmation.png", "r2-77-pending-supplier-confirmation.png"]),
    ("PF-58378 | Value Date",
     "Non Counter Deposit View: Value Date shows '-' while Batch Date is populated (PF-58514).",
     ["ANN-r2-78-view.png", "r2-78-view.png"]),
    ("PF-58378 | NCD Create",
     "Create NCD blocked / float validation on save.",
     ["ANN-r2-78-save.png", "r2-78-save.png"]),
    ("PF-58380 | Receipt Reversal empty",
     "Receipt reversal screen blank / empty — migrated receipt reverse not verifiable.",
     ["ANN-r2-80-rev.png", "r2-80-rev.png"]),
    ("PF-58380 | Inquiry no hit",
     "Account/loan inquiry searches return no hit for seed accounts.",
     ["ANN-r2-80-inq-004225.png", "r2-80-inq-004225.png"]),
    ("PF-58380 | Reallocation / Maint",
     "Reallocation and maintenance screens empty.",
     ["ANN-r2-80-realloc.png", "r2-80-realloc.png"]),
    ("PF-58383 | GBAF/IBAF selector trap",
     "Deep Account Management routes stuck on Select Banking & Finance Type (PF-58398/58416).",
     ["ANN-r2-83-account-management-manage-account.png", "r2-83-account-management-manage-account.png"]),
    ("PF-58383 | Ownership transfer blocked",
     "Ownership transfer / history unreachable past selector.",
     ["ANN-r2-83-maintenance-ownership-transfer.png", "r2-83-maintenance-ownership-transfer.png"]),
    ("PF-58383 | Account inquiry blocked",
     "Account inquiry deep link trapped by selector.",
     ["ANN-r2-83-cNwNb-account-inquiry.png", "r2-83-cNwNb-account-inquiry.png"]),
    ("PF-58560 | Checker login OK",
     "RESOLVED: MethmiB logs in via 'Use my password'. Bug In UAT (Done category).",
     ["ANN-checker-chk-final.png", "chk-final.png"]),
    ("PF-58560 | Checker on PERC",
     "MethmiB reached PERC as checker; Requests tab No Data on approve attempt.",
     ["ANN-checker-chk-approve-attempt.png", "chk-approve-attempt.png"]),
    ("PF-58379 | Accrued Interest",
     "DONE N/A Kenya — feature not on cNwNb UAT build.",
     ["ANN-r2-na-79.png", "r2-na-79.png"]),
    ("PF-58381 | Document Request",
     "DONE N/A Kenya — Document Request not on Kenya COB/Lending build.",
     ["ANN-r2-na-81.png", "r2-na-81.png"]),
    ("PF-58382 | Profit Sharing",
     "DONE N/A Kenya — Islamic profit-sharing not deployed.",
     ["ANN-r2-na-82.png", "r2-na-82.png"]),
    ("PF-58384 | BRWNS SMS",
     "DONE N/A Kenya — SMS/BRWNS templates not on Common Settings.",
     ["ANN-r2-na-84.png", "r2-na-84.png"]),
]


def find_img(names: list[str]) -> Path | None:
    for n in names:
        for root in (ANN, DONE, CHK, RAW):
            p = root / n
            if p.exists():
                return p
    return None


def make_thumb(src: Path, dest: Path, max_w: int = 480) -> tuple[Path, int, int]:
    im = PILImage.open(src).convert("RGB")
    w, h = im.size
    if w > max_w:
        nh = int(h * (max_w / w))
        im = im.resize((max_w, nh), PILImage.Resampling.LANCZOS)
    else:
        nh = h
        max_w = w
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, format="PNG", optimize=True)
    return dest, max_w, nh


def main() -> None:
    if THUMB.exists():
        shutil.rmtree(THUMB, ignore_errors=True)
    THUMB.mkdir(parents=True, exist_ok=True)

    out_primary = Path(r"C:\Users\ThejanaD\Downloads\PF-57868-visual-QA-WITH-IMAGES.xlsx")
    tmp = out_primary.with_suffix(".tmp.xlsx")

    wb = xlsxwriter.Workbook(str(tmp), {"constant_memory": False})
    # FIRST sheet = visual (so user sees images immediately)
    ws = wb.add_worksheet("Kenya UAT Visual QA")
    readme = wb.add_worksheet("README")

    hdr = wb.add_format({
        "bold": True, "font_color": "white", "bg_color": "#1F4E79",
        "align": "center", "valign": "vcenter", "border": 1,
    })
    cell_a = wb.add_format({"bold": True, "valign": "top", "text_wrap": True, "border": 1})
    cell_b = wb.add_format({"valign": "top", "text_wrap": True, "border": 1})
    title = wb.add_format({"bold": True, "font_size": 14})
    body = wb.add_format({"text_wrap": True})

    ws.set_column("A:A", 34)
    ws.set_column("B:B", 70)
    ws.set_column("C:C", 62)
    ws.set_row(0, 26)
    ws.write(0, 0, "Area", hdr)
    ws.write(0, 1, "Issue / Concern", hdr)
    ws.write(0, 2, "Screenshot", hdr)
    ws.freeze_panes(1, 0)

    placed = 0
    missing: list[str] = []
    for i, (area, issue, names) in enumerate(ROWS, start=1):
        src = find_img(names)
        ws.set_row(i, 210)
        ws.write(i, 0, area, cell_a)
        ws.write(i, 1, issue, cell_b)
        if not src:
            ws.write(i, 2, f"MISSING: {names[0]}", cell_b)
            missing.append(names[0])
            continue
        thumb, tw, th = make_thumb(src, THUMB / f"row{i:02d}.png", max_w=480)
        # xlsxwriter: scale so width ~480 px; Excel uses ~96 dpi, x=1 means 100%
        # insert with pixel sizing
        ws.insert_image(
            i, 2, str(thumb),
            {
                "x_offset": 4,
                "y_offset": 4,
                "x_scale": 1.0,
                "y_scale": 1.0,
                "object_position": 1,  # move and size with cells
            },
        )
        placed += 1

    readme.write(0, 0, "PF-57868 Kenya UAT — Visual QA (Book1 style: Area | Issue | Screenshot)", title)
    readme.write(2, 0, "Open sheet tab: Kenya UAT Visual QA  (this README is notes only)", body)
    readme.write(3, 0, f"Embedded screenshots: {placed} | Missing: {len(missing)}", body)
    readme.write(4, 0, "Cycle: 2026-08-31 2-round + annotated red boxes + checker password", body)
    readme.write(5, 0, "DONE N/A: 58379/81/82/84 | Checker 58560 In UAT | PARTIAL product bugs on other stories", body)
    readme.set_column("A:A", 100)

    wb.close()

    copies = [
        Path(r"C:\Users\ThejanaD\Downloads\PF-57868-Kenya-UAT-Book1-style-visual-QA.xlsx"),
        Path(r"C:\Users\ThejanaD\Downloads\PF-57868-visual-QA-WITH-IMAGES.xlsx"),
        Path(r"E:\QAFusionX\workspaces\PF-57868\reports\PF-57868-Kenya-UAT-visual-QA-screenshots.xlsx"),
        Path(r"E:\QAFusionX\workspaces\PF-57868\artifacts\PF-57868-Kenya-UAT-visual-QA-screenshots.xlsx"),
    ]
    # Prefer replacing locked Downloads file last; skip if locked
    for p in copies:
        p.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(tmp, p)
            print("saved", p, "mb", round(p.stat().st_size / 1e6, 2))
        except PermissionError:
            alt = p.with_name(p.stem + "-NEW" + p.suffix)
            shutil.copy2(tmp, alt)
            print("LOCKED skip", p, "-> saved", alt, "mb", round(alt.stat().st_size / 1e6, 2))
    # also try overwrite original visual name via NEW
    legacy = Path(r"C:\Users\ThejanaD\Downloads\PF-57868-Kenya-UAT-visual-QA-screenshots.xlsx")
    try:
        shutil.copy2(tmp, legacy)
        print("saved", legacy)
    except PermissionError:
        alt = Path(r"C:\Users\ThejanaD\Downloads\PF-57868-Kenya-UAT-visual-QA-screenshots-NEW.xlsx")
        shutil.copy2(tmp, alt)
        print("LOCKED ->", alt, "mb", round(alt.stat().st_size / 1e6, 2))
    tmp.unlink(missing_ok=True)
    print("placed", placed, "missing", missing)


if __name__ == "__main__":
    main()
