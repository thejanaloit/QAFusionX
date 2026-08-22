"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ENGINE = process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://127.0.0.1:43180";

type Todo = {
  id: number;
  key: string;
  title: string;
  mode: string;
  status: "locked" | "available" | "in_progress" | "done";
  checkbox: string;
  missingGates: string[];
  note?: string;
};

type Status = {
  runId: string;
  askMode: { unlocked: boolean; projectAnswered: boolean; storiesAnswered: boolean };
  askBanner: string | null;
  currentStep: {
    id: number;
    key: string;
    title: string;
    mode: string;
    status: string;
    instructions: string;
    missingGates: string[];
  };
  todos: Todo[];
  project: { name: string; targetUrl: string; whatToTest: string } | null;
  userStories: { source: string; count: number } | null;
  screenCount: number;
  suite: { running: boolean; passed: number; failed: number; lastMessage?: string } | null;
  issues: { count: number } | null;
  bugs: { count: number } | null;
  rule: string;
};

type FusionEvent = { ts: string; type: string; message: string; stepId?: number };

export default function ControlConsolePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [events, setEvents] = useState<FusionEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [artifactPath, setArtifactPath] = useState("");
  const [artifacts, setArtifacts] = useState<{ name: string; type: "file" | "dir"; path: string }[]>([]);
  const [preview, setPreview] = useState("");

  async function refresh() {
    const res = await fetch(`${ENGINE}/api/state`);
    if (!res.ok) throw new Error("Engine not reachable");
    setStatus(await res.json());
  }

  async function loadArtifacts(rel = "") {
    const res = await fetch(`${ENGINE}/api/artifacts?path=${encodeURIComponent(rel)}`);
    setArtifacts(await res.json());
    setArtifactPath(rel);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
    loadArtifacts().catch(() => undefined);
    const es = new EventSource(`${ENGINE}/api/events`);
    es.onmessage = () => undefined;
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as FusionEvent;
        setEvents((prev) => [...prev.slice(-80), data]);
        if (data.type.startsWith("step") || data.type.startsWith("suite") || data.type.startsWith("demo")) {
          refresh().catch(() => undefined);
        }
      } catch {
        // ignore pings
      }
    };
    es.addEventListener("event", handler);
    ["demo:start", "demo:done", "step:start", "step:done", "suite:test", "suite:result", "crawl:capture", "ask:project"].forEach(
      (name) => es.addEventListener(name, handler),
    );
    const poll = setInterval(() => refresh().catch(() => undefined), 4000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, []);

  async function post(path: string, label: string) {
    setBusy(label);
    setError("");
    try {
      const res = await fetch(`${ENGINE}${path}`, { method: "POST" });
      const body = await res.json();
      if (!body.ok) setError(JSON.stringify(body.error ?? body, null, 2));
      await refresh();
      await loadArtifacts(artifactPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const doneCount = status?.todos.filter((t) => t.status === "done").length ?? 0;

  const askLock = status && !status.askMode.unlocked;

  const current = status?.currentStep;

  const eventLines = useMemo(() => events.slice().reverse(), [events]);

  return (
    <div className="min-h-screen bg-[#070b14] text-zinc-100">
      <header className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-teal-300/80">Sequential MCP QA agent</p>
          <h1 className="text-2xl font-semibold tracking-tight">QAFusionX</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => post("/api/demo/start", "demo")} disabled={Boolean(busy)}>
            {busy === "demo" ? "Running full pipeline…" : "Run guided demo"}
          </Button>
          <Button variant="outline" onClick={() => post("/api/reset", "reset")} disabled={Boolean(busy)}>
            Reset
          </Button>
          <Link href="/sample/login" className="inline-flex h-8 items-center rounded-lg border border-white/15 px-2.5 text-sm">
            Open sample app
          </Link>
        </div>
      </header>

      {askLock ? (
        <div className="border-b border-amber-400/30 bg-amber-400/10 px-5 py-3 text-sm text-amber-100">
          <strong className="mr-2">ASK MODE LOCK</strong>
          Switch Cursor to Ask mode. Question 1: project, what to test, URL, screenshot. Question 2 (compulsory):
          upload user stories as zip, Jira link, or generate-from-system. No later step can run until both are answered.
        </div>
      ) : null}

      {error ? (
        <pre className="max-h-40 overflow-auto border-b border-red-400/30 bg-red-500/10 px-5 py-3 text-xs text-red-100">
          {error}
        </pre>
      ) : null}

      <div className="grid gap-4 p-4 xl:grid-cols-[280px_1fr_320px]">
        <Card className="border-white/10 bg-[#101826]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white/80">
              Pipeline {doneCount}/{status?.todos.length ?? 14}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-220px)] pr-2">
              <ol className="space-y-1">
                {(status?.todos ?? []).map((todo) => (
                  <li
                    key={todo.key}
                    className={cn(
                      "rounded-md px-2 py-2 text-sm",
                      todo.status === "done" && "bg-teal-400/10 text-teal-100",
                      todo.status === "in_progress" && "bg-amber-400/10 text-amber-100",
                      todo.status === "locked" && "text-white/35",
                      todo.status === "available" && "bg-white/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-mono text-[11px] text-white/40">{String(todo.id).padStart(2, "0")}</span>
                      <span>
                        {todo.status === "done" ? "✓ " : todo.status === "locked" ? "○ " : "● "}
                        {todo.title}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/10 bg-[#101826]">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Current step</CardTitle>
                {current ? (
                  <Badge variant="secondary">
                    {current.mode} · {current.status}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/75">
              <p className="text-lg text-white">{current ? `${current.id}. ${current.title}` : "Engine connecting…"}</p>
              <p>{current?.instructions}</p>
              {current?.missingGates.length ? (
                <p className="text-amber-200">Missing gates: {current.missingGates.join(", ")}</p>
              ) : null}
              <p className="text-xs text-white/40">{status?.rule}</p>
              {status?.project ? (
                <p>
                  Target:{" "}
                  <a className="text-teal-300 underline" href={status.project.targetUrl}>
                    {status.project.targetUrl}
                  </a>
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Tabs defaultValue="runner">
            <TabsList>
              <TabsTrigger value="runner">Live runner</TabsTrigger>
              <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
              <TabsTrigger value="ask">Ask questions</TabsTrigger>
            </TabsList>
            <TabsContent value="runner">
              <Card className="border-white/10 bg-[#101826]">
                <CardHeader>
                  <CardTitle className="text-base">Suite console</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap gap-2 text-sm">
                    <Badge>passed {status?.suite?.passed ?? 0}</Badge>
                    <Badge variant="destructive">failed {status?.suite?.failed ?? 0}</Badge>
                    <Badge variant="secondary">{status?.suite?.running ? "running" : "idle"}</Badge>
                    <Badge variant="outline">issues {status?.issues?.count ?? 0}</Badge>
                    <Badge variant="outline">bugs {status?.bugs?.count ?? 0}</Badge>
                  </div>
                  <div className="h-64 overflow-auto rounded-md bg-black/40 p-3 font-mono text-xs leading-5 text-teal-100">
                    {eventLines.length === 0 ? (
                      <p className="text-white/40">Waiting for crawl / suite events…</p>
                    ) : (
                      eventLines.map((e, i) => (
                        <div key={`${e.ts}-${i}`}>
                          <span className="text-white/35">{e.ts.slice(11, 19)}</span>{" "}
                          <span className="text-amber-200">{e.type}</span> {e.message}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="artifacts">
              <Card className="border-white/10 bg-[#101826]">
                <CardHeader>
                  <CardTitle className="text-base">Workspace directories</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => loadArtifacts("")}>
                        Root
                      </Button>
                      {artifactPath ? <span className="text-xs text-white/50">{artifactPath}</span> : null}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {artifacts.map((a) => (
                        <li key={a.path}>
                          <button
                            className="text-left text-teal-200 hover:underline"
                            onClick={async () => {
                              if (a.type === "dir") loadArtifacts(a.path);
                              else {
                                const res = await fetch(`${ENGINE}/api/artifact?path=${encodeURIComponent(a.path)}`);
                                const body = await res.json();
                                setPreview(body.binary ? `(binary) ${a.path}` : body.content);
                              }
                            }}
                          >
                            {a.type === "dir" ? "📁" : "📄"} {a.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-md bg-black/40 p-3 text-xs whitespace-pre-wrap">
                    {preview || "Select a file."}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="ask">
              <Card className="border-white/10 bg-[#101826]">
                <CardHeader>
                  <CardTitle className="text-base">Mandatory Ask-mode questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-white/75">
                  <p>
                    <Badge className="mr-2">{status?.askMode.projectAnswered ? "done" : "open"}</Badge>
                    1. What is this project, and what must be tested? Provide the live URL and a screenshot.
                  </p>
                  <p>
                    <Badge className="mr-2">{status?.askMode.storiesAnswered ? "done" : "open"}</Badge>
                    2. Upload user stories — zip / files, Jira link, or generate from the system.
                  </p>
                  <Separator />
                  <p>
                    Connect the MCP in Cursor (<code className="text-teal-200">npx tsx src/index.ts</code>) and the
                    agent is forced through these questions before any crawl.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Card className="border-white/10 bg-[#101826]">
          <CardHeader>
            <CardTitle className="text-sm">Connect MCP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <p>Add to Cursor MCP settings:</p>
            <pre className="overflow-auto rounded-md bg-black/40 p-3 text-[11px] text-teal-100">{`{
  "mcpServers": {
    "QAFusionX": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "env": {
        "QAFUSIONX_WORKSPACE": "./artifacts"
      }
    }
  }
}`}</pre>
            <p>
              First tool call must be <code>qafusionx_begin</code>. The server instructions lock Ask mode until both
              questions are stored. Completing a step writes a tick in <code>step-by-step/</code> — that tick is the
              only unlock for the next node.
            </p>
            <p className="text-xs text-white/40">Run {status?.runId ?? "—"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
