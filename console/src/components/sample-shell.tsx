"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SampleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const item = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        pathname === href || pathname.startsWith(href + "/")
          ? "bg-white/10 text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#0c1220] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-teal-300/80">
            InfoIns · Sales &amp; Marketing
          </p>
          <h1 className="text-lg font-semibold">Intermediary Management</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/70">
          <span>qa.analyst</span>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-transparent text-white"
            onClick={() => router.push("/sample/login")}
          >
            Sign out
          </Button>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-57px)]">
        <aside className="flex w-56 flex-col gap-1 border-r border-white/10 p-3">
          {item("/sample/home", "Home")}
          {item("/sample/intermediaries", "Intermediaries")}
          {item("/sample/settings", "Settings")}
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
