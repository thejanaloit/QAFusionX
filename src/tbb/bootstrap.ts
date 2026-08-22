import { isTbbLinked, tbbRoot, vaultIndexPath } from "./paths.ts";
import { getJiraToken } from "./vault.ts";

export interface TbbBootstrapStatus {
  linked: boolean;
  tbbRoot: string;
  vaultPath: string;
  vaultReadable: boolean;
  jiraTokenAvailable: boolean;
}

/** Called once at MCP startup — validates TBB link (stderr only; never stdout). */
export function bootstrapTbb(): TbbBootstrapStatus {
  const root = tbbRoot();
  const vaultPath = vaultIndexPath();
  const status: TbbBootstrapStatus = {
    linked: isTbbLinked(),
    tbbRoot: root,
    vaultPath,
    vaultReadable: isTbbLinked(),
    jiraTokenAvailable: Boolean(getJiraToken()),
  };

  if (!status.linked) {
    console.error(
      `[QAFusionX] TBB not linked. Run: powershell -File scripts/install-full-mesh.ps1\n` +
        `  Expected vault: ${vaultPath}`,
    );
  } else {
    console.error(
      `[QAFusionX] TBB linked → ${root} | vault OK | Jira token: ${status.jiraTokenAvailable ? "yes" : "no (store via scripts/store-jira-token.py)"}`,
    );
  }

  return status;
}
