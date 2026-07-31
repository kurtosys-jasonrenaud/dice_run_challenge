import { Check, Copy, Download, ImageDown, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildShareBrief,
  buildShareMessage,
  copyImage,
  copyText,
  createShareImage,
  downloadBlob,
  shareFilename,
} from "../lib/share";
import type { ChallengeRoll } from "../types/challenge";
import { Button, Card } from "./ui/primitives";

interface ShareBriefProps {
  rolls: ChallengeRoll[];
  logoUrl: string;
}

type Status = "idle" | "copied-text" | "copied-image" | "downloaded" | "error";

export function ShareBrief({ rolls, logoUrl }: ShareBriefProps) {
  const brief = useMemo(() => buildShareBrief(rolls), [rolls]);
  const message = useMemo(() => buildShareMessage(brief), [brief]);
  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);

  function flash(next: Status) {
    setStatus(next);
    window.setTimeout(() => setStatus("idle"), 2200);
  }

  async function handleCopyText() {
    try {
      await copyText(message);
      flash("copied-text");
    } catch {
      flash("error");
    }
  }

  async function withImage(action: (blob: Blob) => Promise<void>, next: Status) {
    setBusy(true);
    try {
      const blob = await createShareImage(brief, logoUrl);
      await action(blob);
      flash(next);
    } catch {
      flash("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="share" aria-labelledby="share-title">
      <div className="mb-5">
        <p className="eyebrow">Send to the group</p>
        <h2 id="share-title" className="section-title">Share tomorrow’s run</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Copy a message or image for Slack, Teams, or WhatsApp.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="lift-card overflow-hidden border-primary/20 bg-ink p-0 text-white">
          <div className="relative overflow-hidden bg-primary px-6 py-8 sm:px-8 sm:py-10">
            <div className="absolute -right-16 -top-20 size-56 rounded-full border border-white/20" />
            <div className="absolute right-10 top-10 size-3 animate-pulse rounded-full bg-signal shadow-[0_0_20px_var(--signal)]" />
            <p className="eyebrow text-signal">Kurtosys · August 2026</p>
            <p className="mt-4 text-sm font-semibold text-white/70">
              {brief.isWeekend ? "Weekend brief" : "Tomorrow’s run"}
            </p>
            <p className="mt-2 text-sm text-white/70">{brief.dateLabel}</p>
            <p className="mt-6 font-display text-5xl font-black tracking-tight text-signal sm:text-6xl">
              {brief.headline}
            </p>
            <p className="mt-4 max-w-md text-base leading-7 text-white/85">{brief.detail}</p>
            <p className="mt-2 max-w-md text-sm text-white/65">{brief.note}</p>
            {brief.diceLine && (
              <p className="mt-5 text-sm font-semibold text-signal">{brief.diceLine}</p>
            )}
          </div>
        </Card>

        <Card className="lift-card flex flex-col justify-center gap-3 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-primary" />
            <h3 className="font-display text-xl font-bold">Share</h3>
          </div>

          <Button onClick={handleCopyText}>
            {status === "copied-text" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {status === "copied-text" ? "Message copied" : "Copy message"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              withImage(
                async (blob) => downloadBlob(blob, shareFilename(brief.date)),
                "downloaded",
              )
            }
          >
            <Download className="size-4" />
            {status === "downloaded" ? "Image downloaded" : busy ? "Creating image…" : "Download image"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => withImage(copyImage, "copied-image")}
          >
            <ImageDown className="size-4" />
            {status === "copied-image" ? "Image copied" : "Copy image"}
          </Button>

          <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">
            {status === "error"
              ? "Could not copy or create the share file in this browser. Try Download image instead."
              : null}
          </p>
        </Card>
      </div>
    </section>
  );
}
