import Link from "next/link";
import { notFound } from "next/navigation";
import { SampleShell } from "@/components/sample-shell";
import { buttonVariants } from "@/components/ui/button";
import { getIntermediary } from "@/lib/sample-store";
import { cn } from "@/lib/utils";

export default async function ViewIntermediaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = getIntermediary(id);
  if (!item) notFound();

  return (
    <SampleShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/50">{item.code}</p>
          <h2 className="text-2xl font-semibold">{item.displayName}</h2>
        </div>
        <div className="flex gap-2">
          <Link href="/sample/intermediaries" className={cn(buttonVariants({ variant: "outline" }), "border-white/20 bg-transparent text-white")}>
            Back to list
          </Link>
          <Link href={`/sample/intermediaries/${item.id}/edit`} className={cn(buttonVariants())}>
            Manage
          </Link>
        </div>
      </div>
      <div className="grid max-w-2xl gap-4 rounded-lg border border-white/10 bg-[#141b2d] p-5 text-sm">
        <Row k="Channel" v={item.channel} />
        <Row k="Licence" v={item.licence} />
        <Row k="Email" v={item.email} />
        <Row k="Mobile" v={item.mobile} />
        <h3 className="pt-2 text-base font-medium">Emergency Details</h3>
        {item.emergency ? (
          <>
            <Row k="Emergency Name" v={item.emergency.name} />
            <Row k="Relationship Type" v={item.emergency.relationshipType ?? "(missing)"} />
            <Row k="Emergency Contact Detail" v={item.emergency.contact} />
            <Row k="Emergency Address" v={item.emergency.address || "(none)"} />
          </>
        ) : (
          <p className="text-white/50">No emergency details on file</p>
        )}
      </div>
    </SampleShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-white/50">{k}</span>
      <span>{v}</span>
    </div>
  );
}
