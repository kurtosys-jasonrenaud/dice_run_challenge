import {
  CHALLENGE_LABEL,
  formatDate,
  fromIsoDate,
  getChallengeLabel,
  getRollForDate,
  isPendingRoll,
  toIsoDate,
} from "./challenge";
import type { ChallengeRoll } from "../types/challenge";

export const SITE_URL = "https://kurtosys-jasonrenaud.github.io/dice_run_challenge/";

export interface ShareBriefData {
  date: Date;
  dateLabel: string;
  headline: string;
  detail: string;
  note: string;
  diceLine: string | null;
  nextLine: string | null;
  isRest: boolean;
  isWeekend: boolean;
  isPending: boolean;
  distanceKm: number | null;
}

export function getShareDate(from: Date = new Date()): Date {
  const shareDate = new Date(from);
  shareDate.setDate(from.getDate() + 1);
  return shareDate;
}

export function buildShareBrief(
  rolls: ChallengeRoll[],
  date: Date = getShareDate(),
): ShareBriefData {
  const day = date.getDay();
  const roll = getRollForDate(rolls, date);
  const dateLabel = formatDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (day === 1 && (!roll || roll.type === "rest")) {
    return {
      date,
      dateLabel,
      headline: "Rest day",
      detail: "Monday is always a rest day.",
      note: "No distance to complete. Recover and reset.",
      diceLine: null,
      nextLine: null,
      isRest: true,
      isWeekend: false,
      isPending: false,
      distanceKm: 0,
    };
  }

  if (!roll || isPendingRoll(roll)) {
    return {
      date,
      dateLabel,
      headline: "Pending",
      detail: "Tomorrow’s challenge has not been recorded yet.",
      note: "Record today’s office dice result to unlock tomorrow’s run.",
      diceLine: null,
      nextLine: null,
      isRest: false,
      isWeekend: day === 0 || day === 6,
      isPending: true,
      distanceKm: null,
    };
  }

  const label = getChallengeLabel(roll.distanceKm, roll.type, roll.diceValue);
  const isWeekend = roll.type === "weekend" || day === 0 || day === 6;
  const isRest = roll.distanceKm === 0 || roll.type === "rest";

  return {
    date,
    dateLabel,
    headline: label,
    detail: isWeekend
      ? "Weekend challenge · complete once on Saturday or Sunday"
      : `Challenge for ${formatDate(fromIsoDate(roll.challengeDate), {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}`,
    note: isRest
      ? "Rest day. No distance to complete."
      : "Complete any time tomorrow. Run, jog, or walk.",
    diceLine:
      roll.diceValue !== null
        ? `Office dice: ${roll.diceValue}${
            roll.rollDate
              ? ` · rolled ${formatDate(fromIsoDate(roll.rollDate), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}`
              : ""
          }`
        : null,
    nextLine: null,
    isRest,
    isWeekend,
    isPending: false,
    distanceKm: roll.distanceKm,
  };
}

export function buildShareMessage(brief: ShareBriefData): string {
  const lines = [
    `Kurtosys Roll & Run · ${CHALLENGE_LABEL}`,
    "",
    brief.isWeekend ? `Weekend · ${brief.dateLabel}` : `Tomorrow · ${brief.dateLabel}`,
    `Challenge: ${brief.headline}`,
  ];

  if (brief.diceLine) lines.push(brief.diceLine);
  if (brief.detail) lines.push(brief.detail);
  lines.push(brief.note);
  lines.push("");
  lines.push(SITE_URL);

  return lines.join("\n");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

export async function createShareImage(
  brief: ShareBriefData,
  logoUrl: string,
): Promise<Blob> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0342E4");
  gradient.addColorStop(0.55, "#0342E4");
  gradient.addColorStop(1, "#071935");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(920, 180, 260, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(920, 180, 180, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(49,255,156,0.45)";
  ctx.stroke();

  ctx.fillStyle = "#31FF9C";
  ctx.beginPath();
  ctx.arc(840, 70, 14, 0, Math.PI * 2);
  ctx.fill();

  try {
    const logo = await loadImage(logoUrl);
    const logoWidth = 280;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    ctx.drawImage(logo, 72, 72, logoWidth, logoHeight);
  } catch {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 42px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("KURTOSYS", 72, 120);
  }

  ctx.fillStyle = "#31FF9C";
  ctx.font = "700 28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("ROLL & RUN CHALLENGE", 72, 210);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 26px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(CHALLENGE_LABEL.toUpperCase(), 72, 260);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 34px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(brief.isWeekend ? "Weekend brief" : "Tomorrow’s run", 72, 360);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(brief.dateLabel, 72, 410);

  roundRect(ctx, 72, 470, width - 144, 420, 36);
  ctx.fillStyle = "rgba(7, 25, 53, 0.42)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#31FF9C";
  ctx.font = "800 120px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(brief.headline, 110, 620);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 34px 'Plus Jakarta Sans', sans-serif";
  wrapText(ctx, brief.detail, 110, 700, width - 220, 44);

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "500 30px 'Plus Jakarta Sans', sans-serif";
  wrapText(ctx, brief.note, 110, 800, width - 220, 40);

  if (brief.diceLine) {
    ctx.fillStyle = "#31FF9C";
    ctx.font = "600 28px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(brief.diceLine, 110, 900);
  }

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 24px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Run · jog · walk · rejoin anytime", 72, 1220);
  ctx.fillText(SITE_URL.replace("https://", ""), 72, 1268);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not create share image"));
      else resolve(blob);
    }, "image/png");
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let offsetY = y;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, offsetY);
      line = word;
      offsetY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, offsetY);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export async function copyImage(blob: Blob) {
  if (!("ClipboardItem" in window)) {
    throw new Error("Image clipboard is not supported in this browser");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type]: blob }),
  ]);
}

export function shareFilename(date: Date): string {
  return `roll-and-run-${toIsoDate(date)}.png`;
}
