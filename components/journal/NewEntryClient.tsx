"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { JournalEditor } from "@/components/journal/JournalEditor";
import { COLORS } from "@/lib/constants";

export function NewEntryClient() {
  const router = useRouter();
  return (
    <Shell>
      <div style={{ padding: "18px 22px 28px", minHeight: 720 }}>
        <Link href="/journal" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={16} /> Journal
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 26, color: COLORS.parchment, margin: "18px 0 14px" }}>New entry</h1>
        <JournalEditor
          onSaved={() => {
            router.push("/journal");
            router.refresh();
          }}
          onCancel={() => router.push("/journal")}
        />
      </div>
    </Shell>
  );
}
