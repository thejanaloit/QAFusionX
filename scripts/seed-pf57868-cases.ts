/**
 * Seed PF-57868 human test cases + research, then complete step 9.
 * Run: QAFUSIONX_WORKSPACE=... npx tsx scripts/seed-pf57868-cases.ts
 */
import {
  saveHumanTestCase,
  saveHumanQaResearch,
  completeHumanTestCases,
} from "../src/actions/index.ts";
import type { HumanTestCase } from "../src/testdocs/format.ts";

const base = {
  affectsVersions: "UAT Kenya",
  testCaseType: "Functional",
  assignee: "Thejana Dewmina",
  reporter: "Nilmie Gamhewa",
  parent: "PF-57868",
  module: "CRM OLD",
  submodule: "Customer Onboarding",
} as const;

const cases: HumanTestCase[] = [
  {
    ...base,
    id: "TC-CRM-U1-LOGIN-GUI",
    linked: "PF-57987",
    feature: "Azure AD Login",
    typeCode: "FP",
    assertion:
      "Validate that a Kenya UAT branch user can sign in via Azure AD and land on the Customer Onboarding dashboard",
    priority: "Highest",
    labels: ["U1", "Login", "AzureAD", "GUI", "Regression", "PF-57868"],
    layer: "gui",
    preconditions: [
      "Valid Azure AD credentials are available for Kenya UAT tenant cNwNb",
      "Browser can reach https://uat.fusionx.biz/web/home/cNwNb/dashboard",
    ],
    steps: [
      "Open the Kenya UAT entry URL and complete AuNEXO Continue with AzureAd",
      "Enter the branch user email and password on Microsoft login",
      "Confirm KMSI with Yes if prompted",
      "Open CRM OLD / COB onboarding dashboard",
    ],
    expected:
      "User reaches authenticated COB Customer Onboarding dashboard (FACILITIES / CUSTOMER SEARCH) without remaining on Azure or AuNEXO login.",
    comments: "Maps to story PF-57987 U1.",
    actual: "None.",
  },
  {
    ...base,
    id: "TC-CRM-U2-REACHABLE-GUI",
    linked: "PF-57988",
    feature: "CRM OLD Module",
    typeCode: "FP",
    assertion:
      "Validate that the CRM OLD Customer Onboarding module is reachable with FACILITIES and CUSTOMER SEARCH chrome",
    priority: "Highest",
    labels: ["U2", "CRM-OLD", "Reachability", "GUI", "Regression", "PF-57868"],
    layer: "gui",
    preconditions: ["User is authenticated as Duruma branch user on Kenya UAT"],
    steps: [
      "From home, open Customer Relationship Management (OLD) or deep-link to /web/comn-react-module-cob/cNwNb/onboarding",
      "Wait past Authenticating splash",
      "Observe left tiles FACILITIES and CUSTOMER SEARCH",
    ],
    expected:
      "COB module loads with FACILITIES and CUSTOMER SEARCH visible on the Customer Onboarding dashboard.",
    comments: "Flip-card may not navigate; deep-link is acceptable recovery for U2.",
    actual: "None.",
  },
  {
    ...base,
    id: "TC-CRM-D1-FACILITIES-GUI",
    linked: "PF-57991",
    feature: "Start Onboarding",
    typeCode: "FP",
    assertion:
      "Validate that selecting facilities and Search Customer opens Start Onboarding or the customer form",
    priority: "High",
    labels: ["D1", "Facilities", "StartOnboarding", "GUI", "Regression", "PF-57868"],
    layer: "gui",
    preconditions: ["Authenticated on COB onboarding dashboard"],
    steps: [
      "Open FACILITIES and select one or more facilities",
      "Activate Search Customer / Start Onboarding path",
      "Confirm Start Onboarding or General Information form is shown",
    ],
    expected:
      "Facilities can be listed/selected and Search Customer reaches Start Onboarding or customer identification form.",
    comments: "FACILITIES a11y click is known-flaky; force click allowed.",
    actual: "None.",
  },
  {
    ...base,
    id: "TC-CRM-D2-ACTIONS-GUI",
    linked: "PF-57989",
    feature: "Customer Search ACTIONS",
    typeCode: "FP",
    assertion:
      "Validate that Customer Search returns a result row with ACTIONS after querying a customer identification",
    priority: "High",
    labels: ["D2", "CustomerSearch", "ACTIONS", "GUI", "Regression", "PF-57868"],
    layer: "gui",
    preconditions: ["Authenticated on COB; Customer Search form available"],
    steps: [
      "Enter a customer identification value (e.g. TEST)",
      "Click Search",
      "Inspect results grid for ACTIONS / edit / view controls",
    ],
    expected: "A customer result row with ACTIONS is returned (not an empty-only state).",
    comments: "Honest runner searches TEST; may fail if UAT has no matching data.",
    actual: "None.",
  },
  {
    ...base,
    id: "TC-CRM-EMPTY-SEARCH-GUI",
    linked: "PF-57989",
    feature: "Customer Search Validation",
    typeCode: "FP",
    assertion:
      "Validate that empty Customer Search shows required-field validation before querying",
    priority: "High",
    labels: ["D2", "Validation", "EmptySearch", "GUI", "BugCandidate", "PF-57868"],
    layer: "gui",
    preconditions: ["Authenticated on COB Customer Search form"],
    steps: [
      "Clear all Customer Search fields",
      "Click Search with no parameters",
      "Observe validation / toast / required cues",
    ],
    expected:
      "UI shows required / please enter one / mandatory validation and stays on search (does not silently open /onboarding/new).",
    comments: "Round 2 observed navigation to /onboarding/new with no validation — expect FAIL until fixed.",
    actual: "None.",
  },
  {
    ...base,
    id: "TC-CRM-F1-GENERAL-INFO-GUI",
    linked: "PF-57990",
    feature: "Individual General Information",
    typeCode: "FP",
    assertion:
      "Validate that Individual General Information is reachable from the onboarding Search Customer path",
    priority: "High",
    labels: ["F1", "GeneralInformation", "Individual", "GUI", "Regression", "PF-57868"],
    layer: "gui",
    preconditions: ["Authenticated on COB"],
    steps: [
      "Select facilities if required",
      "Use Search Customer / search path to open new onboarding",
      "Confirm General Information / organization type / resident fields",
    ],
    expected:
      "Individual General Information surface is shown (general information or organization type + resident).",
    comments: "Maps to PF-57990 F1.",
    actual: "None.",
  },
  {
    ...base,
    id: "TC-CRM-AML-TOKEN-API",
    linked: "PF-57986",
    feature: "AML Authentication Token",
    typeCode: "API",
    assertion:
      "Validate that AML get-authentication-token returns a healthy response without uat-sl.fusionx.biz host failure",
    priority: "Highest",
    labels: ["AML", "API", "Token", "PF-57986", "PF-57868"],
    layer: "api",
    preconditions: ["Authenticated session cookies available for uat.fusionx.biz"],
    steps: [
      "GET /comn-customer/aml-integration/cNwNb/get-authentication-token with session cookies",
      "Inspect HTTP status and response body for uat-sl.fusionx.biz",
    ],
    expected:
      "Endpoint returns success and does not configure / return the unresolved uat-sl.fusionx.biz host.",
    comments: "Known defect PF-57986 — honest suite should FAIL until host is fixed for Kenya.",
    actual: "None.",
  },
  {
    ...base,
    id: "TC-CRM-COB-SHELL-API",
    linked: "PF-57868",
    feature: "COB Module Shell",
    typeCode: "API",
    assertion:
      "Validate that the COB onboarding shell URL responds for tenant cNwNb under an authenticated session",
    priority: "Medium",
    labels: ["API", "COB", "Shell", "PF-57868"],
    layer: "api",
    preconditions: ["Authenticated session for Kenya UAT"],
    steps: [
      "Request https://uat.fusionx.biz/web/comn-react-module-cob/cNwNb/onboarding with session cookies",
      "Confirm non-auth-redirect HTML/app shell is returned",
    ],
    expected: "COB onboarding shell is reachable (not bounced to AuNEXO/Azure login).",
    comments: "Companion API/GUI shell probe for parent PF-57868.",
    actual: "None.",
  },
];

const research = `# Human QA research — PF-57868 CRM OLD / COB Kenya UAT

## How a senior human QA would approach this

1. **Auth first (U1):** Always prove Azure AD branch login to Duruma Road Branch1 before module claims. Capture KMSI and final dashboard screenshot.
2. **Module reachability (U2):** Click CRM OLD flip-card; if URL stays on home, record defect and verify deep-link \`/web/comn-react-module-cob/cNwNb/onboarding\` as workaround — do not accept flip animation alone.
3. **Never open Cash/ATM tiles** while testing this parent; they are different products and previously stranded the session.
4. **Facilities (D1):** Open FACILITIES, note every facility including anomalies (TTTT). Multi-select, then Search Customer / Start Onboarding.
5. **Customer Search (D2):** Positive search with known ID; negative empty search must show validation; ACTIONS column only counts when a result row exists.
6. **General Information (F1):** Confirm Individual defaults, ENGLISH language, branch prefill, Start Onboarding gate, then skim CONTACT / BANK / OTHER.
7. **AML (PF-57986):** Network tab on onboarding load; assert get-authentication-token; file/keep single bug if uat-sl host appears — do not spam duplicates.
8. **Evidence:** PNG + short note per failed assert; prefer headed browser so stakeholders watch.

## Risk-based priority

Highest: U1 login, U2 reachability, AML token host, empty-search validation.  
High: D1 facilities → Start Onboarding, D2 ACTIONS, F1 GI.  
Medium: PEP/Reports/Remove Assignee nav smoke.

## Out of scope for this pack

Smart Customer Onboarding home tile, Cash personalization, other Core Banking modules, Google SSO on AuNEXO.
`;

for (const tc of cases) {
  const r = saveHumanTestCase(tc);
  console.log("saved", r.saved, "count", r.count);
}
saveHumanQaResearch(research);
const status = completeHumanTestCases();
console.log(
  JSON.stringify(
    {
      current: status.currentStep?.key,
      human: status.todos?.find((t) => t.id === 9)?.checkbox,
    },
    null,
    2,
  ),
);
