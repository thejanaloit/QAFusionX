import { SampleShell } from "@/components/sample-shell";

export default function SettingsPage() {
  return (
    <SampleShell>
      <h2 className="mb-4 text-2xl font-semibold">Settings</h2>
      <div className="max-w-lg space-y-3 rounded-lg border border-white/10 bg-[#141b2d] p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-white/50">Affects versions</span>
          <span>1.2.25-QA</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Jira project</span>
          <span>NFNS</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Parent epic</span>
          <span>NFNS-279 SALES MODULE</span>
        </div>
      </div>
    </SampleShell>
  );
}
