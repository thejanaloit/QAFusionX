"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SampleShell } from "@/components/sample-shell";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Intermediary } from "@/lib/sample-store";

export default function IntermediaryListPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Intermediary[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q") ?? "";
    setQ(initial);
  }, []);

  useEffect(() => {
    const url = q ? `/api/sample/intermediaries?q=${encodeURIComponent(q)}` : "/api/sample/intermediaries";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [q]);

  return (
    <SampleShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Intermediaries</h2>
          <p className="text-sm text-white/60">Add new or manage existing records.</p>
        </div>
        <Link href="/sample/intermediaries/new?step=basic" className={cn(buttonVariants())}>
          Add new intermediary
        </Link>
      </div>
      <Input
        placeholder="Search by code or name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-md border-white/15 bg-[#141b2d] text-white"
      />
      {items.length === 0 ? (
        <p className="rounded-md border border-white/10 bg-[#141b2d] px-4 py-8 text-center text-white/60">
          No intermediaries match
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Code</TableHead>
                <TableHead className="text-white/70">Display name</TableHead>
                <TableHead className="text-white/70">Channel</TableHead>
                <TableHead className="text-white/70">Status</TableHead>
                <TableHead className="text-white/70">Emergency on file</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} className="border-white/10">
                  <TableCell>{row.code}</TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell>{row.channel}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.emergency ? "Yes" : "No"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Link href={`/sample/intermediaries/${row.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-white")}>
                      View
                    </Link>
                    <Link href={`/sample/intermediaries/${row.id}/edit`} className={cn(buttonVariants({ size: "sm" }))}>
                      Manage
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SampleShell>
  );
}
