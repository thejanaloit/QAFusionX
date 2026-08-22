import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import * as actions from "./actions/index.ts";
import { bus } from "./events.ts";
import { isBlocked, WorkflowBlocked } from "./workflow/engine.ts";
import { STEPS } from "./workflow/steps.ts";
import { runGuidedDemo } from "./demo/runDemo.ts";

const PORT = Number(process.env.QAFUSIONX_PORT ?? 43180);
const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true, name: "QAFusionX", port: PORT }));
app.get("/api/state", (c) => c.json(actions.status()));
app.get("/api/steps", (c) => c.json(STEPS));
app.get("/api/artifacts", (c) => {
  const rel = c.req.query("path") ?? "";
  return c.json(actions.artifactTree(rel));
});
app.get("/api/artifact", (c) => {
  const rel = c.req.query("path");
  if (!rel) return c.json({ error: "path required" }, 400);
  try {
    return c.json(actions.readArtifact(rel));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 404);
  }
});

app.get("/api/events", (c) =>
  streamSSE(c, async (stream) => {
    for (const past of bus.history.slice(-40)) {
      await stream.writeSSE({ event: past.type, data: JSON.stringify(past) });
    }
    const onEvent = async (event: (typeof bus.history)[number]) => {
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
    };
    bus.on("event", onEvent);
    const timer = setInterval(() => stream.writeSSE({ event: "ping", data: "{}" }), 15_000);
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        bus.off("event", onEvent);
        clearInterval(timer);
        resolve();
      });
    });
  }),
);

function wrap<T>(fn: () => Promise<T> | T) {
  return async () => {
    try {
      return { ok: true as const, data: await fn() };
    } catch (err) {
      if (isBlocked(err) && err instanceof WorkflowBlocked) {
        return { ok: false as const, blocked: true, error: err.toJSON() };
      }
      return { ok: false as const, blocked: false, error: err instanceof Error ? err.message : String(err) };
    }
  };
}

app.post("/api/begin", async (c) => c.json(await wrap(() => actions.begin())()));
app.post("/api/reset", async (c) => c.json(await wrap(() => actions.resetState())()));
app.post("/api/submit-project", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.submitProject(body))());
});
app.post("/api/submit-user-stories", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.submitUserStories(body))());
});
app.post("/api/persist", async (c) => c.json(await wrap(() => actions.persistWorkspace())()));
app.post("/api/crawl/open", async (c) => c.json(await wrap(() => actions.crawlOpen())()));
app.post("/api/crawl/capture", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.crawlCapture(body))());
});
app.post("/api/crawl/reference", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.saveScreenReference(body))());
});
app.post("/api/crawl/click", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.crawlClick(body))());
});
app.post("/api/round/complete", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.completeRound(body.round, body.coverageNote))());
});
app.post("/api/system-map", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.saveSystemMap(body.markdown))());
});
app.post("/api/testcases", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.saveHumanTestCase(body))());
});
app.post("/api/testcases/research", async (c) => {
  const body = await c.req.json();
  return c.json(await wrap(() => actions.saveHumanQaResearch(body.markdown))());
});
app.post("/api/testcases/complete", async (c) => c.json(await wrap(() => actions.completeHumanTestCases())()));
app.post("/api/jira/testcases", async (c) => c.json(await wrap(() => actions.uploadJiraTestCases())()));
app.post("/api/yaml", async (c) => c.json(await wrap(() => actions.convertYaml())()));
app.post("/api/scripts", async (c) => c.json(await wrap(() => actions.generateScripts())()));
app.post("/api/suite/run", async (c) => c.json(await wrap(() => actions.runSuite())()));
app.post("/api/issues/export", async (c) => c.json(await wrap(() => actions.exportIssues())()));
app.post("/api/jira/bugs", async (c) => c.json(await wrap(() => actions.fileBugs())()));
app.post("/api/demo/start", async (c) => c.json(await wrap(() => runGuidedDemo())()));

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
  console.log(`QAFusionX engine on http://127.0.0.1:${info.port}`);
});
