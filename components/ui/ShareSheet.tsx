"use client";

import { useEffect, useState } from "react";
import { Download, Link2, Share2, X } from "lucide-react";
import { COLORS, alpha } from "@/lib/constants";

interface ShareSheetProps {
  item: { id: string; text: string; attributed_to: string };
  onClose: () => void;
  onToast: (msg: string) => void;
}

// Share a quote as an image card (rendered by /api/card/[id]) or as a link.
// The image is fetched as soon as the sheet opens, so tapping "Share image"
// can call the share sheet straight away (browsers require it to follow a tap
// closely, which a slow download in between would break).
export function ShareSheet({ item, onClose, onToast }: ShareSheetProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    fetch(`/api/card/${item.id}?theme=${theme}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const f = new File([blob], "discipline-quote.png", { type: "image/png" });
        url = URL.createObjectURL(blob);
        setFile(f);
        setPreview(url);
        try {
          setCanShareFile(!!navigator.canShare?.({ files: [f] }));
        } catch {
          setCanShareFile(false);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const link = () => `${window.location.origin}/feed?item=${item.id}`;

  const shareImage = async () => {
    if (!file) return;
    if (canShareFile) {
      try {
        await navigator.share({ files: [file], title: "Discipline", text: `“${item.text}” — ${item.attributed_to}` });
        onClose();
      } catch {
        // Dismissed: keep the sheet open.
      }
      return;
    }
    // No file sharing (most desktops): download it instead.
    const a = document.createElement("a");
    a.href = preview ?? URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    onToast("Image downloaded");
    onClose();
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Discipline", text: item.text, url: link() });
      } else {
        await navigator.clipboard.writeText(link());
        onToast("Link copied");
      }
      onClose();
    } catch {
      // Dismissed.
    }
  };

  const btn = (primary: boolean, disabled = false) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 10px",
    borderRadius: 10,
    border: primary ? "none" : `1px solid ${COLORS.line}`,
    background: primary ? COLORS.brass : "transparent",
    color: primary ? COLORS.onBrass : COLORS.parchment,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 50, background: alpha(COLORS.ink, 92), display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ padding: "18px 20px 26px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: COLORS.parchment, fontWeight: 600 }}>Share</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
            <X size={18} color={COLORS.slate} />
          </button>
        </div>

        <div
          style={{
            alignSelf: "center",
            width: "min(100%, 300px)",
            aspectRatio: "4 / 5",
            borderRadius: 10,
            overflow: "hidden",
            border: `1px solid ${COLORS.line}`,
            background: COLORS.ink2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={`Quote card: ${item.text}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span style={{ fontSize: 12, color: COLORS.slate }}>{failed ? "Couldn't make the image." : "Making the card…"}</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={shareImage} disabled={!file} style={btn(true, !file)}>
            {canShareFile ? <Share2 size={16} /> : <Download size={16} />}
            {canShareFile ? "Share image" : "Download image"}
          </button>
          <button onClick={shareLink} style={btn(false)}>
            <Link2 size={16} /> {typeof navigator !== "undefined" && "share" in navigator ? "Share link" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
