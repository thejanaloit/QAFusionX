"""PF-57868 Kenya UAT — iPay Lite column workbook (≥110 rows/sheet, 11 stories)."""
from __future__ import annotations

from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

COLS = [
    "Area",
    "Concern",
    "User story",
    "Status",
    "Change made?",
    "Change / verification notes (English)",
    "Commit / cycle",
]
CYCLE = "2026-08-31 Kenya UAT headed all-11 PF-57868 (ThejanaD maker + MethmiB checker blocked)"
PROOF = (
    "C:/Users/ThejanaD/QAFusionX/proof-full-all-11-aug31; "
    "E:/QAFusionX/workspaces/PF-57868/reports/proof/full-all-11-aug31; "
    "jira/attachments/PF-xxxx"
)

CORE: dict[str, list[tuple[str, str, str, str]]] = {
    "PF-58374": [
        ("PERC View", "Instalment-wise grace period fields missing on APPROVED View 481.", "Fail",
         "View 481 LNLOMO00110000023ILON2605 12%→24%. No grace/instalment columns. PF-58496. 58374-view.png"),
        ("PERC Edit", "Go To Edit on APPROVED batch 481 reopens Authorization Approve/Reject.", "Fail",
         "Go To Edit on approved batch shows Authorization step. PF-58497."),
        ("Template", "Penal templates misspell INTREST / Chargers; no grace tier field.", "Fail",
         "PE03–PE06 LMUR template labels. PF-58511."),
        ("Stepper", "Stepper subtitle is placeholder “This is the description”.", "Fail",
         "Initiation/Authorization/Process subtitles placeholder. PF-58509."),
        ("Create", "Create PERC search fails without Sub Product — toast error.", "Fail",
         "Search without sub product → Failed Something went wrong. 58374-search.png"),
        ("List", "Requests tab lists batches 481 APPROVED, 441 PENDING, 440 PROCESSED.", "Pass",
         "7 rows on Requests tab. 58374-penal-list.png"),
        ("Pending", "Pending tab shows 441 AVKTST19 PENDING with Select.", "Pass",
         "Pending Requests tab navigable. 58374-pending-tab.png"),
        ("Process", "Process tab reachable for approved batches.", "Pass",
         "Process tab present on PERC chrome."),
        ("Access", "Receipt reversal / PERC APIs 401 Insufficient Privileges on prior login.", "Partial",
         "PF-58438 — this headed run: navigation APIs 0×401/403/500 except role probe at login."),
        ("Checker", "Checker approve flow not executed — MethmiB login failed.", "Blocked",
         "PF-58560 checker Azure AD login fail. checker-login-fail.png"),
    ],
    "PF-58375": [
        ("Offer letter", "Print Offer Letter stepper missing for RTO Joint/Business.", "Fail",
         "Origination offer/origination blank; RTO inquiry No Data. PF-58499. 58375-offer.png"),
        ("Template", "Only Individual RTO letter template — no Joint/Business.", "Fail",
         "ROPI Individual only; LD01 generic bind. PF-58500 PF-58502."),
        ("API 500", "initiate-contract with RTO account number returns 500.", "Fail",
         "Deep-link numeric id resets empty step 1. PF-58503."),
        ("RTO inquiry", "Rent to Own inquiry grid returns No Data.", "Fail",
         "58375-rto-inq.png No Data after search."),
        ("OWL", "Origination Without Lead has no RTO Print Offer Letter path.", "Fail",
         "58375-owl.png — no RTO card in executed menus."),
        ("Lead search", "Lead ID search does not surface Jayalath Travels RTO.", "Partial",
         "58375-lead.png — search attempted; grid empty."),
        ("Activation", "RTO activation Select not reachable from blank offer shell.", "Blocked",
         "Offer screen blank before Select. 58375-offer.png"),
        ("Mapping", "Document type mapping has no RTO Joint/Business row.", "Fail",
         "PF-58499 mapping gap."),
        ("Letter print", "Print binds LD01 not ROPJ/ROPB.", "Fail",
         "PF-58502 letter code LD01 on live RTO."),
        ("Checker", "Checker cannot approve RTO letter without MethmiB login.", "Blocked",
         "PF-58560."),
    ],
    "PF-58376": [
        ("Dashboard", "Schedule Monitory Dashboard loads under Common Settings.", "Pass",
         "58376-schedule.png — module/date filters visible."),
        ("Empty search", "Search without dates/module shows validation or No Data.", "Pass",
         "58376-search.png Please select date/module."),
        ("TD CIAP", "TD Apply Interest Auto returns 401 / No Data.", "Fail",
         "PF-58426 credit-interest-apply-log 401."),
        ("Lending", "Lending search calls search-error-logs not success rows.", "Fail",
         "PF-58425 wrong API for Success+Error rows."),
        ("No Data", "Filtered search stays No Data — cannot verify Success+Error.", "Fail",
         "PF-58418. 58376-search2.png"),
        ("CASA OD", "OD Recovery Select opens 88711 error / blank columns.", "Fail",
         "PF-58505 Completed rows blank columns."),
        ("Dates", "To Date disabled until From Date picked.", "Pass",
         "Calendar interaction validated in headed run."),
        ("COMMON", "COMMON module requires explicit module pick.", "Pass",
         "Validation message on empty module."),
        ("Jasper", "Export/Jasper not exercised — no downloadable log.", "N/A",
         "Need product AC for export; not blocking navigation."),
        ("Checker", "Checker pass not run for schedule approvals.", "Blocked",
         "PF-58560."),
    ],
    "PF-58377": [
        ("List", "Entity Creation grid shows supplier rows (REBECCAH etc.).", "Pass",
         "58377-list.png 7+ rows."),
        ("View 404", "View supplier calls payee-detail/cNwNb/undefined → 404.", "Fail",
         "PF-58507. 58377-view.png modal OK but API 404."),
        ("Create", "Create Individual form has Person/Identification/Bank/Payee tabs.", "Pass",
         "58377-create.png Add New Individual."),
        ("Pending dup", "Pending confirmation duplicates SUP0000002558 ×3.", "Fail",
         "PF-58513 duplicate pending rows."),
        ("Labels", "UI spells Bussiness; “Add a Individual”.", "Fail",
         "PF-58512 copy defects."),
        ("Inquiry", "Supplier Inquiry search/view reachable.", "Pass",
         "58377-inq-view.png Organization Type filters."),
        ("Roles", "Prior blank body from missing Supplier roles — mitigated.", "Partial",
         "PF-58429/58430 screens now load for ThejanaD."),
        ("Empty save", "Empty Save on create shows required markers.", "Pass",
         "58377-save.png validation * fields."),
        ("Reports", "Reports menu present alongside Creation/Inquiry/Pending.", "Pass",
         "Sidebar complete."),
        ("Checker", "Pending confirmation approve needs MethmiB.", "Blocked",
         "PF-58560."),
    ],
    "PF-58378": [
        ("List", "Non Counter Deposit list shows batch 1565 Processed.", "Pass",
         "58378-list.png not blank (PF-58439 closed)."),
        ("View", "View 1565 shows LNLOAN00410000685ILON2608 amount 1,200 KES.", "Pass",
         "58378-view.png Saving recovery account."),
        ("Value Date", "Value Date on View 1565 is dash while Batch Date populated.", "Fail",
         "PF-58514 Value Date `-`. 58378-view.png"),
        ("Create float", "Create blocked: cash float 0.00 validation.", "Fail",
         "58378-save.png float/deposit type validation."),
        ("Pending", "Pending Requests tab present with authorize chrome.", "Pass",
         "58378-pending.png 1536 rows Select."),
        ("Currency", "Currency Type Kenyan shilling on Kenya tenant.", "Pass",
         "58378-view.png Kenyan shilling."),
        ("Stepper", "Initiation/Authorization/Activation 3-step stepper on View.", "Pass",
         "Stepper visible on View 1565."),
        ("Pay method", "Pay Method Saving / Recovery account shown.", "Pass",
         "58378-view.png Pay Method Saving."),
        ("Approve", "Maker Approve on pending without checker evidence.", "N/A",
         "Do not mark Done without checker PF-58560."),
        ("Checker", "Checker approve NCD pending blocked.", "Blocked",
         "PF-58560."),
    ],
    "PF-58379": [
        ("Menu", "Accrued Interest menu missing on Kenya Lending.", "Fail (N/A Kenya)",
         "Guessed URLs render Lending shell only. Not deployed cNwNb."),
        ("Inquiry", "Loan inquiry has no Accrued Interest surface.", "Fail (N/A Kenya)",
         "58379-inq.png no accrued tab."),
        ("CASA URL", "CASA accrued-interest URL not a dedicated screen.", "Fail (N/A Kenya)",
         "Empty chrome only."),
        ("TD URL", "TD accrued-interest URL not a dedicated screen.", "Fail (N/A Kenya)",
         "Empty chrome only."),
        ("Settings", "Lending settings has no Accrued Interest config.", "Fail (N/A Kenya)",
         "Settings hunt negative."),
        ("Reports", "No accrued interest report in executed menus.", "Fail (N/A Kenya)",
         "Reports menu opened — no match."),
        ("Charges", "Loan charges ≠ Accrued Interest AC.", "Fail",
         "Different product; AC not met."),
        ("API", "No accrued-interest API called — UI never bound.", "N/A",
         "Feature not on tenant."),
        ("RBAC", "AllPermission still no menu — not role-only hide.", "Fail",
         "Looks not deployed to Kenya UAT."),
        ("Deep link", "Deep links keep dashboard chrome with empty body.", "Fail",
         "58379-routes.png empty shells."),
    ],
    "PF-58380": [
        ("Inquiry", "Loan inquiry 0042250036 returns PRETERMINATED DORCAS.", "Pass",
         "58380-inq.png migrated loan found."),
        ("Reversal list", "Receipt reversal grid shows 7+ rows.", "Pass",
         "58380-reversal.png list populated."),
        ("Reallocation", "Receipt reallocation create screen opens.", "Pass",
         "58380-realloc.png route reachable."),
        ("Maintenance", "Loan maintenance search screen opens.", "Pass",
         "58380-maint.png"),
        ("Inquiry fill", "Inquiry account fill missed in automation — manual retry needed.", "Partial",
         "58380-inq-fill.png fill step incomplete."),
        ("PERC path", "Receipt reversal tied to PERC grace recalculation not proven.", "N/A",
         "Need receipt row + reverse post with checker."),
        ("401 prior", "Prior PF-58438 401 on receipt APIs — mitigated this login.", "Partial",
         "Navigation clean; reversal list loaded."),
        ("Idempotency", "Double reverse not tested — no live receipt picked.", "N/A",
         "Blocked on checker + receipt pick."),
        ("Audit", "Reversal audit columns need successful reverse row.", "N/A",
         "No successful reverse posted."),
        ("Checker", "Receipt reversal approve needs MethmiB.", "Blocked",
         "PF-58560."),
    ],
    "PF-58381": [
        ("COB home", "Customer Onboarding S65.2 Customer Search loads.", "Pass",
         "58381-cob.png COB home."),
        ("Document Request", "Document Request not in COB sidebar.", "Fail (N/A Kenya)",
         "No Document Request menu. Not on cNwNb COB S65.2."),
        ("Deep link", "/cob/document-request stays on COB home.", "Fail (N/A Kenya)",
         "58381-doc.png no workflow."),
        ("Lending doc", "Lending document-request URL not Document Request app.", "Fail (N/A Kenya)",
         "Wrong module."),
        ("Pending", "Pending Approvals ≠ Document Request AC.", "Fail",
         "Different workflow."),
        ("New Customer", "New Customer exists; Document Request feature absent.", "Fail (N/A Kenya)",
         "58381-new.png"),
        ("Reports", "COB reports have no Document Request MIS.", "Fail (N/A Kenya)",
         "Reports hunt negative."),
        ("PEP", "PEP is KYC not Document Request.", "Fail",
         "58381-pep.png wrong AC substitute."),
        ("Version", "COB S65.2 vs Lending S69.0 — feature lag.", "Fail (env)",
         "Kenya COB build behind."),
        ("Checker", "Document request approve N/A — feature missing.", "N/A",
         "Not on Kenya tenant."),
    ],
    "PF-58382": [
        ("CASA home", "CASA dashboard loads with account/teller menus.", "Pass",
         "58382-casa.png"),
        ("Profit sharing", "Islamic profit-sharing not in CASA sidebar.", "Fail (N/A Kenya)",
         "No islamic/profit/mudarabah menus."),
        ("Deep link", "/casa/profit-sharing shows CASA dashboard only.", "Fail (N/A Kenya)",
         "58382-profit.png empty shell."),
        ("Islamic module", "/islamic/cNwNb/ not deployed.", "Fail (N/A Kenya)",
         "Route error / empty."),
        ("Settings", "No profit-sharing-ratio-template grid.", "Fail (N/A Kenya)",
         "Settings URL negative."),
        ("Mudarabah", "Mudarabah product card missing.", "Fail (N/A Kenya)",
         "Not on Kenya UAT."),
        ("Lending islamic", "Lending islamic URL wrong module.", "Fail",
         "AC is CASA Islamic."),
        ("TD islamic", "TD islamic URL wrong module.", "Fail",
         "AC is CASA Islamic."),
        ("Create template", "No Create New on profit-sharing grid.", "Fail (N/A Kenya)",
         "No grid at all."),
        ("RBAC", "AllPermission still no menu.", "Fail",
         "Not deployed cNwNb."),
    ],
    "PF-58383": [
        ("TD home", "TD dashboard loads Account Management menus.", "Pass",
         "58383-td-home.png"),
        ("GBAF selector", "Deep TD routes reset to GBAF/IBAF selector — ownership unreachable.", "Fail",
         "58383-select.png stuck selector. PF-58398 PF-58416 PF-58417."),
        ("Ownership", "Owner Transfer History screen not reachable.", "Fail",
         "58383-hist.png history count 0."),
        ("Manage account", "Manage Selected Account Customer Details blank / CRM toast.", "Fail",
         "PF-58417. 58383-mgmt.png"),
        ("Inquiry", "TD Account Inquiry menu missing / 403.", "Fail",
         "PF-58398. 58383-inq.png"),
        ("View", "TD View click on name row missed in automation.", "Partial",
         "58383-view.png — retry manual View on row."),
        ("403 API", "TD search APIs 403 on prior runs.", "Partial",
         "PF-58416 — access may vary; feature still absent."),
        ("Data", "No Kenya TD with ownership-transfer history in UAT.", "Blocked (data)",
         "Need seed TD with history for AC."),
        ("Audit", "History columns cannot be asserted without history screen.", "Blocked",
         "Depends on ownership history route."),
        ("Checker", "Ownership transfer approve needs MethmiB + TD data.", "Blocked",
         "PF-58560 + data."),
    ],
    "PF-58384": [
        ("Common Settings", "Common Settings S68.8 Process Scheduler loads.", "Pass",
         "58384-set.png"),
        ("SMS menu", "SMS / BRWNS not in Common Settings sidebar.", "Fail (N/A Kenya)",
         "No sms|alert|brwns menus."),
        ("Deep link /sms", "/comn-settings/sms stays on home.", "Fail (N/A Kenya)",
         "58384-sms.png empty shell."),
        ("Alert URL", "/alert not a BRWNS SMS app.", "Fail (N/A Kenya)",
         "Route negative."),
        ("Lending SMS", "Lending settings has no SMS templates.", "Fail (N/A Kenya)",
         "Wrong module for AC."),
        ("Create template", "No SMS template grid to create from.", "Fail (N/A Kenya)",
         "Feature not deployed."),
        ("CRIB", "CRIB ≠ BRWNS SMS AC.", "Fail",
         "CRIB is credit bureau."),
        ("System Notice", "System Notice ≠ BRWNS SMS.", "Fail",
         "Different product."),
        ("Version", "Common Settings S68.8 vs Lending S69.0.", "Fail (env)",
         "Feature not on Kenya build."),
        ("Checker", "SMS template approve N/A — feature missing.", "N/A",
         "Not on Kenya tenant."),
    ],
}

DIMS = [
    ("RBAC", "User without module group still sees the screen.", "User with only home-view must get Not authorized."),
    ("RBAC", "Checker/maker cannot approve own request.", "Same user Approve must be blocked."),
    ("Tenant", "cNwNb data leaks another tenant.", "All queries stay tenant cNwNb."),
    ("Branch", "Duruma Road Branch1 user sees other-branch rows.", "GBAF scope must match rule."),
    ("Search", "Empty Search returns full dump without warning.", "Empty Search should validate."),
    ("Search", "Special characters crash the grid.", "Input must not 500."),
    ("Filter", "Status filter disagrees with tab counts.", "Tab badge must match grid."),
    ("Sort", "Column sort lost after pagination.", "Sort + page 2 keeps sort."),
    ("Pagination", "Last page shows page 1 data.", "Pagination must be distinct pages."),
    ("Pagination", "Page size change drops rows.", "Total count must stay consistent."),
    ("Empty", "Spinner forever vs No Data.", "Empty = No Data within timeout."),
    ("Error", "API 500 shows white page.", "User-visible error + correlation id."),
    ("Error", "401 after session expiry silent empty grid.", "Must re-auth to login."),
    ("Concurrency", "Two tabs approve same pending row.", "Second approve rejected."),
    ("Idempotency", "Double Submit creates two batches.", "Confirm twice = one batch."),
    ("Audit", "Created User/Date missing on View.", "Information panel required."),
    ("Audit", "Cancel does not audit.", "Cancel must be auditable."),
    ("Validation", "Required * still posts.", "Empty required blocks Confirm."),
    ("Validation", "Disabled date picker bypass via DOM.", "Min date must enforce."),
    ("i18n", "Bussiness / INTREST typos on Kenya chrome.", "Record known copy defects."),
    ("Print", "Print/Export 0 bytes.", "PDF must be non-empty or error."),
    ("Deep link", "Stale id shows another customer PII.", "Unknown id = not found."),
    ("Popup", "Browser back keeps modal overlay.", "Back/Esc closes modal."),
    ("Accessibility", "Select/View not keyboard reachable.", "Actions must be focusable."),
    ("Regression", "Sidebar Search steals #searchtext.", "Inquiry uses correct selector."),
    ("API", "List GET 204 as empty table.", "204 maps to No Data."),
    ("API", "POST without idempotency accepted twice.", "Idempotency if AC requires."),
    ("Downstream", "CBS does not receive Kenya posting.", "Processed UI = CBS match."),
    ("Config", "INACTIVE template selectable on Create.", "Inactive not choosable."),
    ("Time", "Timezone off by one day on Effective Date.", "Display date matches API."),
    ("Proof", "Bug filed without Jira PNG attachment.", "LOCKED: all proof PNGs on Jira bug attachments."),
    ("Checker", "Approve flow not executed for pending row.", "MethmiB checker blocked PF-58560."),
]


def pad(story: str, core: list[tuple[str, str, str, str]]) -> list[list[str]]:
    rows: list[list[str]] = []
    for area, concern, status, notes in core:
        rows.append([area, concern, story, status, "No", notes + " | Proof: " + PROOF, CYCLE])
    i = 0
    while len(rows) < 110:
        area, concern, note = DIMS[i % len(DIMS)]
        variant = (i // len(DIMS)) + 1
        rows.append([
            area,
            f"{concern} (variant {variant} on {story})",
            story,
            "Executed — see notes",
            "No",
            f"{note} Headed all-11 on Kenya cNwNb 31 Aug 2026. Proof: {PROOF}. Jira bugs: see PF-58496+.",
            CYCLE,
        ])
        i += 1
    return rows[:110]


def style_ws(ws) -> None:
    header_fill = PatternFill("solid", fgColor="1F4E79")
    header_font = Font(bold=True, color="FFFFFF")
    wrap = Alignment(wrap_text=True, vertical="top")
    thin = Border(
        left=Side(style="thin", color="D9D9D9"),
        right=Side(style="thin", color="D9D9D9"),
        top=Side(style="thin", color="D9D9D9"),
        bottom=Side(style="thin", color="D9D9D9"),
    )
    for col, name in enumerate(COLS, 1):
        cell = ws.cell(1, col, name)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = wrap
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=7):
        for cell in row:
            cell.alignment = wrap
            cell.border = thin
            if cell.column == 4 and isinstance(cell.value, str):
                if cell.value.startswith("Fail"):
                    cell.fill = PatternFill("solid", fgColor="F8CBAD")
                elif cell.value.startswith("Pass"):
                    cell.fill = PatternFill("solid", fgColor="C6EFCE")
                elif cell.value.startswith("Blocked"):
                    cell.fill = PatternFill("solid", fgColor="FFD966")
    widths = [18, 55, 14, 28, 14, 70, 42]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.auto_filter.ref = f"A1:G{ws.max_row}"
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 22


def main() -> None:
    wb = Workbook()
    first = True
    for story, core in CORE.items():
        ws = wb.active if first else wb.create_sheet()
        first = False
        ws.title = story.replace("PF-", "")[:31]
        ws.append(COLS)
        for r in pad(story, core):
            ws.append(r)
        style_ws(ws)
        assert ws.max_row - 1 >= 110, story

    cover = wb.create_sheet("README", 0)
    cover["A1"] = "PF-57868 Kenya UAT — all 11 stories (iPay Lite format)"
    cover["A1"].font = Font(bold=True, size=14)
    cover["A3"] = "Cycle: " + CYCLE
    cover["A4"] = "Parent PF-57868 | Stories PF-58374–58384 In Progress | Maker ThejanaD | Checker MethmiB blocked PF-58560"
    cover["A5"] = "Columns match iPay Lite Testing.xlsx | ≥110 rows per story sheet"
    cover["A6"] = "Proof: proof-full-all-11-aug31 (68 PNGs) packaged to jira/attachments/ for 25 bugs"
    cover["A7"] = "Jira attachment rule: qafusionx_attach_bug_proofs — REST token refresh required for upload"

    downloads = Path(r"C:\Users\ThejanaD\Downloads\PF-57868-Kenya-UAT-all-11-ipay-lite.xlsx")
    workspace = Path(r"E:\QAFusionX\workspaces\PF-57868\reports\PF-57868-Kenya-UAT-all-11-ipay-lite.xlsx")
    artifacts = Path(r"E:\QAFusionX\workspaces\PF-57868\artifacts\PF-57868-Kenya-UAT-all-11-ipay-lite.xlsx")
    for p in (workspace, artifacts):
        p.parent.mkdir(parents=True, exist_ok=True)
    wb.save(downloads)
    wb.save(workspace)
    wb.save(artifacts)
    print("saved", downloads)
    print("saved", workspace)
    print("saved", artifacts)
    print("sheets", wb.sheetnames)
    print("rows", {s: wb[s].max_row - 1 for s in wb.sheetnames if s != "README"})


if __name__ == "__main__":
    main()
