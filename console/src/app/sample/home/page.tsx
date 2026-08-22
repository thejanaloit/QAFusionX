import Link from "next/link";
import { SampleShell } from "@/components/sample-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SampleHomePage() {
  return (
    <SampleShell>
      <p className="mb-2 text-sm text-white/60">Module home</p>
      <h2 className="mb-6 text-2xl font-semibold">Sales &amp; Marketing workspace</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-[#141b2d]">
          <CardHeader>
            <CardTitle className="text-white">Intermediary Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <p>Add new and manage intermediaries, including Emergency Details.</p>
            <Link href="/sample/intermediaries" className={cn(buttonVariants())}>
              Open Intermediaries
            </Link>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#141b2d] opacity-60">
          <CardHeader>
            <CardTitle className="text-white">Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70">Not in this slice.</CardContent>
        </Card>
        <Card className="border-white/10 bg-[#141b2d] opacity-60">
          <CardHeader>
            <CardTitle className="text-white">Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-white/70">Not in this slice.</CardContent>
        </Card>
      </div>
    </SampleShell>
  );
}
