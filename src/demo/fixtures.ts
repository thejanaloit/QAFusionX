import type { HumanTestCase } from "../testdocs/format.ts";

export const SEED_STORIES = [
  {
    name: "US-001-add-intermediary.md",
    content: `# US-001 Add new intermediary with emergency details

As a Sales officer, I want to add a new intermediary including Emergency Details so that we can contact a related person during an incident.

## Acceptance
- Add New/Manage Intermediary form is available from Intermediary Management.
- Emergency Details section contains Emergency Name, Relationship Type, Emergency Contact Detail, and Emergency Address (optional).
- Saving a complete record persists the intermediary on the list.
`,
  },
  {
    name: "US-002-manage-intermediary.md",
    content: `# US-002 Manage intermediary emergency details

As a Sales officer, I want to manage an existing intermediary so that emergency information can be corrected without recreating the record.

## Acceptance
- Manage form loads previously saved emergency fields.
- Relationship Type remains visible and editable.
- Changes are saved and reflected on the next view.
`,
  },
  {
    name: "US-003-optional-address.md",
    content: `# US-003 Emergency address is optional

As a Sales officer, I want Emergency Address to be optional so that I can save a record when only a name and phone are known.

## Acceptance
- Emergency Address is labelled optional.
- The form can be submitted without an address.
- API does not require address.
`,
  },
  {
    name: "US-004-relationship-types.md",
    content: `# US-004 Relationship types

As a Sales officer, I need Relationship Type values: Spouse, Parent, Sibling, Child, Friend, Guardian, Other.

## Acceptance
- All seven values appear in the dropdown.
- Guardian is available (common for junior intermediaries).
`,
  },
  {
    name: "US-005-phone-validation.md",
    content: `# US-005 Emergency contact must be a valid phone number

As a Sales officer, I want Emergency Contact Detail to reject letters so that we never store an unusable contact.

## Acceptance
- Non-numeric values show a validation error.
- A plausible international / local phone is accepted.
`,
  },
];

export const SEED_CASES: HumanTestCase[] = [
  {
    id: "TC-IM-EMERGENCY-FIELDS",
    module: "Sales & Marketing Module",
    submodule: "Intermediary Management",
    feature: "Add new/Manage",
    typeCode: "FP",
    assertion:
      "Validate that the Emergency Details section displays all required fields",
    affectsVersions: "1.2.25-QA",
    testCaseType: "Functional",
    priority: "Medium",
    labels: [
      "AddNew/ManageIntermediary-Functional",
      "IntermediaryManagement-Functional",
      "Regression",
      "SalesAndMarketing",
    ],
    parent: "NFNS-279 SALES MODULE",
    linked: "NFNS-33152 Add new/Manage Intermediary",
    assignee: "Janith Bodaragama",
    reporter: "QAFusionX",
    preconditions: [
      "User is logged into the system with valid credentials.",
      "User is on the intermediary form.",
    ],
    steps: [
      "Open Add New/Manage Intermediary form.",
      "Navigate to Preferences / Emergency Details section.",
      "Observe all available fields.",
    ],
    comments: "None.",
    expected:
      "Emergency Details shall include: Emergency Name, Relationship Type, Emergency Contact Detail, Emergency Address (optional).",
    actual: "None.",
    layer: "gui",
  },
  {
    id: "TC-IM-PHONE-VALIDATION",
    module: "Sales & Marketing Module",
    submodule: "Intermediary Management",
    feature: "Add new/Manage",
    typeCode: "FP",
    assertion: "Validate that Emergency Contact Detail rejects non-numeric input",
    affectsVersions: "1.2.25-QA",
    testCaseType: "Functional",
    priority: "High",
    labels: [
      "AddNew/ManageIntermediary-Functional",
      "IntermediaryManagement-Functional",
      "Regression",
      "SalesAndMarketing",
    ],
    parent: "NFNS-279 SALES MODULE",
    linked: "NFNS-33152 Add new/Manage Intermediary",
    reporter: "QAFusionX",
    preconditions: [
      "User is logged into the system with valid credentials.",
      "Add New Intermediary form is open on Emergency Details.",
    ],
    steps: [
      "Enter a valid Emergency Name.",
      "Select Relationship Type = Parent.",
      "Enter 'not-a-phone' in Emergency Contact Detail.",
      "Attempt to continue / save.",
    ],
    comments: "None.",
    expected: "The form shows a phone validation error and does not proceed.",
    actual: "None.",
    layer: "gui",
  },
  {
    id: "TC-IM-RELATIONSHIP-GUARDIAN",
    module: "Sales & Marketing Module",
    submodule: "Intermediary Management",
    feature: "Add new/Manage",
    typeCode: "FP",
    assertion: "Validate that Relationship Type includes Guardian",
    affectsVersions: "1.2.25-QA",
    testCaseType: "Functional",
    priority: "Medium",
    labels: [
      "AddNew/ManageIntermediary-Functional",
      "IntermediaryManagement-Functional",
      "Regression",
      "SalesAndMarketing",
    ],
    parent: "NFNS-279 SALES MODULE",
    linked: "NFNS-33152 Add new/Manage Intermediary",
    reporter: "QAFusionX",
    preconditions: ["User is logged in.", "Emergency Details section is visible."],
    steps: [
      "Open the Relationship Type dropdown.",
      "Inspect the available values.",
    ],
    comments: "None.",
    expected:
      "Dropdown lists Spouse, Parent, Sibling, Child, Friend, Guardian, Other.",
    actual: "None.",
    layer: "gui",
  },
  {
    id: "TC-IM-LOGIN",
    module: "Sales & Marketing Module",
    submodule: "Authentication",
    feature: "Sign in",
    typeCode: "FP",
    assertion: "Validate that a user can sign in with valid credentials",
    affectsVersions: "1.2.25-QA",
    testCaseType: "Functional",
    priority: "High",
    labels: ["Authentication-Functional", "Regression", "SalesAndMarketing"],
    parent: "NFNS-279 SALES MODULE",
    reporter: "QAFusionX",
    preconditions: ["The application login page is reachable."],
    steps: [
      "Open the login page.",
      "Enter username qa.analyst and password FusionX@2026.",
      "Click Sign in.",
    ],
    comments: "None.",
    expected: "User lands on the Sales & Marketing home with Intermediary Management visible.",
    actual: "None.",
    layer: "gui",
  },
  {
    id: "TC-IM-LIST",
    module: "Sales & Marketing Module",
    submodule: "Intermediary Management",
    feature: "List",
    typeCode: "FP",
    assertion: "Validate that the intermediary list shows existing records",
    affectsVersions: "1.2.25-QA",
    testCaseType: "Functional",
    priority: "Medium",
    labels: ["IntermediaryManagement-Functional", "Regression", "SalesAndMarketing"],
    parent: "NFNS-279 SALES MODULE",
    reporter: "QAFusionX",
    preconditions: ["User is logged in."],
    steps: [
      "Open Intermediary Management from home.",
      "Observe the table of intermediaries.",
    ],
    comments: "None.",
    expected: "At least one intermediary row is listed with code, name, and status.",
    actual: "None.",
    layer: "gui",
  },
  {
    id: "TC-IM-EMERGENCY-API",
    module: "Sales & Marketing Module",
    submodule: "Intermediary Management",
    feature: "Add new/Manage",
    typeCode: "API",
    assertion: "Validate that the emergency API returns relationship type and optional address",
    affectsVersions: "1.2.25-QA",
    testCaseType: "Functional",
    priority: "High",
    labels: [
      "IntermediaryManagement-API",
      "Regression",
      "SalesAndMarketing",
    ],
    parent: "NFNS-279 SALES MODULE",
    linked: "NFNS-33152 Add new/Manage Intermediary",
    reporter: "QAFusionX",
    preconditions: ["API is reachable at /api/sample."],
    steps: [
      "GET /api/sample/intermediaries/IM-1001/emergency",
      "Inspect relationshipType and addressRequired.",
    ],
    comments: "None.",
    expected:
      "relationshipType is a non-empty string and addressRequired is false (address is optional).",
    actual: "None.",
    layer: "api",
  },
  {
    id: "TC-IM-HEALTH-API",
    module: "Sales & Marketing Module",
    submodule: "Platform",
    feature: "Health",
    typeCode: "API",
    assertion: "Validate that the sample API health endpoint responds",
    affectsVersions: "1.2.25-QA",
    testCaseType: "Functional",
    priority: "Low",
    labels: ["Platform-API", "Smoke"],
    parent: "NFNS-279 SALES MODULE",
    reporter: "QAFusionX",
    preconditions: ["API is reachable."],
    steps: ["GET /api/sample/health"],
    comments: "None.",
    expected: "HTTP 200 with ok=true.",
    actual: "None.",
    layer: "api",
  },
];

export const SYSTEM_MAP = `# Complete system map — InfoIns Sales & Marketing / Intermediary Management (sample target)

This document is the exhaustive end-to-end idea of the application under test as crawled by QAFusionX. It is the second input (with user stories) for human test-case authoring. It is intentionally long: a short map is rejected by the workflow gate.

## 1. Product identity
- Product family: InfoIns Sales & Marketing Module
- Capability: Intermediary Management — Add new / Manage
- Sample origin (when running the Control Console): \`/sample/login\`
- Authenticated chrome: left navigation (Home, Intermediaries, Settings), top bar with analyst identity, module title "Sales & Marketing"
- Demo credentials: username \`qa.analyst\` / password \`FusionX@2026\`

## 2. Screen catalogue

### 2.1 Login (\`/sample/login\`)
Purpose: gate the module. Fields: Username, Password. Buttons: Sign in. Links: none that leave the product except forgotten-password placeholder (disabled in sample). Empty state: validation text when either field is blank. Error state: "Invalid credentials" banner. Loading: button shows Signing in… Popup: none. From here the only in-product path is a successful sign-in to Home.

### 2.2 Home (\`/sample/home\`)
Purpose: module landing. Cards: Intermediary Management, Pipeline (disabled sample), Documents (disabled sample). Buttons: Open Intermediaries, Open Settings. Empty/loading: cards always present. Error: none. Reachable: Intermediary list, Settings, Sign out.

### 2.3 Intermediary list (\`/sample/intermediaries\`)
Purpose: index of intermediaries. Table columns: Code, Display name, Channel, Status, Emergency contact on file, Actions. Buttons: Add new intermediary, row Manage, row View. Empty state: "No intermediaries match" if search filters everything. Search field filters by name/code. Popup: none on this screen. Reachable: Add-new wizard, View, Manage/edit, Home, Settings.

### 2.4 Add new wizard (\`/sample/intermediaries/new\`)
Multi-step form. Query \`?step=\` selects the section. Steps:
1. Basic details — Code (read-only suggested), Display name, Channel (Broker / Bancassurance / Agency), Licence number. Buttons: Continue.
2. Contact — Work email, Mobile, Business address. Buttons: Back, Continue.
3. Preferences / Emergency Details — Emergency Name, Relationship Type, Emergency Contact Detail, Emergency Address. Buttons: Back, Continue. This is the functional heart of NFNS-style case NFNS-33628.
4. Documents — optional file name placeholder. Buttons: Back, Continue.
5. Review — read-only summary. Buttons: Back, Save intermediary.

Popups: unsaved-changes dialog if the user clicks the module nav mid-wizard (sample "Leave wizard?" dialog with Stay / Leave). Validation popups on Continue if required fields of the current step are empty.

### 2.5 View intermediary (\`/sample/intermediaries/[id]\`)
Read-only identity + emergency snapshot. Buttons: Manage, Back to list. Empty emergency: "No emergency details on file".

### 2.6 Manage / edit (\`/sample/intermediaries/[id]/edit\`)
Same sections as Add new, prefilled. Save writes to the in-memory store.

### 2.7 Settings (\`/sample/settings\`)
Affects version label, Jira project key display, sign-out. No popups.

## 3. Path matrix (from → to)
- Login → Home (valid credentials)
- Login → Login (invalid / empty)
- Home → Intermediary list
- Home → Settings
- Home → Login (sign out)
- List → Add new (step basic)
- List → View
- List → Manage
- Add new basic → contact → emergency → documents → review → List (save)
- Add new any step → Leave wizard popup → List or stay
- View → Manage
- View → List
- Manage → View (after save)
- Any authenticated → Settings
- Settings → Home

Every in-product button listed in Round 1 / Round 2 reference files must appear in this matrix. If a crawl reference mentions a control that is not in this matrix, the map is incomplete.

## 4. Emergency Details field contract (source of truth)
From user stories US-001 and US-003 and the Jira functional pattern:
- Emergency Name — required, free text
- Relationship Type — required, enum: Spouse, Parent, Sibling, Child, Friend, Guardian, Other
- Emergency Contact Detail — required, phone
- Emergency Address — optional

Defects the sample intentionally plants (so the suite has real issues to export):
- Address is marked with a required asterisk in the GUI even though the story says optional.
- Guardian is missing from the Relationship Type dropdown.
- Phone field accepts letters.
- GET /api/sample/intermediaries/IM-1001/emergency returns \`relationshipType: null\` and \`addressRequired: true\`.

## 5. API map
- GET /api/sample/health → { ok, product, version }
- GET /api/sample/intermediaries → { items: Intermediary[] }
- GET /api/sample/intermediaries/:id
- GET /api/sample/intermediaries/:id/emergency
- POST /api/sample/intermediaries
- PUT /api/sample/intermediaries/:id
- POST /api/sample/login → { token, displayName } or 401

API-level tests must exist for health and emergency, even when GUI tests already cover the screen. QAFusionX always writes both layers.

## 6. Empty, loading, error states to cover
- Login empty fields
- Login invalid credentials
- List search with zero hits
- Wizard step continue with blank required fields
- View record with no emergency details
- API 404 for unknown intermediary id

## 7. How a human QA would move
A human tester logs in, opens Intermediary Management, uses Add new to walk every wizard step, concentrates on Emergency Details, tries optional address omitted, tries Guardian, tries letters in the phone, saves, re-opens Manage to confirm persistence, repeats on an existing record, then hits the emergency API with a REST client. QAFusionX encodes that exact journey as Jira-format cases, YAML, GUI scripts, and API scripts.

## 8. Traceability
| Story | Screens | Cases |
| US-001 | Add new wizard emergency + review | TC-IM-EMERGENCY-FIELDS |
| US-002 | View + Manage | TC-IM-LIST, manage path in crawl |
| US-003 | Emergency address optional | TC-IM-EMERGENCY-FIELDS, TC-IM-EMERGENCY-API |
| US-004 | Relationship dropdown | TC-IM-RELATIONSHIP-GUARDIAN |
| US-005 | Phone validation | TC-IM-PHONE-VALIDATION |

## 9. Crawl notes
Round 1 walks login → home → list → add new (all steps, including the leave-wizard popup) → view → manage → settings.
Round 2 re-enters login error, empty search, and the emergency step in isolation to catch anything Round 1 skipped.

This map is the complete idea of the sample system. Downstream test authoring must not invent modules that are not listed here, and must not drop Emergency Details coverage.
`;
