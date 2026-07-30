import { Check, LockKeyhole } from "lucide-react";
import { useState } from "react";
import {
  formatDate,
  getChallengeDate,
  getDistance,
  getRollType,
  rollAppliesToChallenge,
} from "../lib/challenge";
import { cn } from "../lib/utils";
import type { ChallengeRoll, DiceValue } from "../types/challenge";
import { Button, Card } from "./ui/primitives";

const FACES: DiceValue[] = [1, 2, 3, 4, 5, 6];

const PIPS: Record<DiceValue, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value }: { value: DiceValue }) {
  return (
    <div className="dice-grid" role="img" aria-label={`Dice showing ${value}`}>
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={PIPS[value].includes(index) ? "dice-pip opacity-100" : "dice-pip opacity-0"}
        />
      ))}
    </div>
  );
}

interface DiceRollerProps {
  hasRolled: boolean;
  existingRoll?: ChallengeRoll;
  onSave: (value: DiceValue, distance: number) => void;
}

export function DiceRoller({ hasRolled, existingRoll, onSave }: DiceRollerProps) {
  const today = new Date();
  const type = getRollType(today);
  const challengeDate = getChallengeDate(today);
  const inChallenge = rollAppliesToChallenge(today);
  const savedValue = existingRoll?.diceValue ?? null;
  const [value, setValue] = useState<DiceValue>(savedValue ?? 1);

  const locked = hasRolled || !type || !inChallenge;
  const distance = type && inChallenge ? getDistance(value, type) : null;
  const needsChoice = Array.isArray(distance);

  const caption = !inChallenge
    ? "This challenge is for August 2026 only. Record office rolls when they set an August challenge day."
    : !type
      ? "Office rolls happen Monday to Friday afternoon."
      : hasRolled
        ? `Office roll saved for ${challengeDate ? formatDate(challengeDate) : "the next challenge"}.`
        : `Record today’s real office roll for ${
            challengeDate ? formatDate(challengeDate) : "tomorrow"
          } (${type === "weekend" ? "weekend" : "weekday"}).`;

  function save(choice?: 4 | 8) {
    if (!type || locked || !inChallenge) return;
    const result = getDistance(value, type, choice);
    if (Array.isArray(result)) return;
    onSave(value, result);
  }

  return (
    <Card className="relative overflow-hidden border-primary/40 bg-ink p-5 text-white sm:p-7">
      <div className="absolute -right-14 -top-20 size-56 rounded-full bg-primary/40 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <p className="eyebrow text-signal">Office dice · August 2026</p>
          <h2 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">
            Record the real roll
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/70">{caption}</p>

          {!locked && (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">
                What did the office dice show?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FACES.map((face) => (
                  <button
                    key={face}
                    type="button"
                    onClick={() => setValue(face)}
                    className={cn(
                      "grid size-11 place-items-center rounded-full border text-sm font-bold transition",
                      value === face
                        ? "border-signal bg-signal text-ink"
                        : "border-white/25 bg-white/5 text-white hover:border-white/60",
                    )}
                    aria-pressed={value === face}
                    aria-label={`Dice face ${face}`}
                  >
                    {face}
                  </button>
                ))}
              </div>
            </div>
          )}

          {needsChoice && !locked && (
            <div className="mt-4" aria-live="polite">
              <p className="text-sm font-semibold">Face 6 means choose the distance:</p>
              <div className="mt-2 flex gap-2">
                <Button className="bg-signal text-ink hover:bg-white" size="sm" onClick={() => save(4)}>
                  Save 4 km
                </Button>
                <Button className="bg-signal text-ink hover:bg-white" size="sm" onClick={() => save(8)}>
                  Save 8 km
                </Button>
              </div>
            </div>
          )}

          {!needsChoice && (
            <Button
              className="mt-5 bg-signal text-ink hover:bg-white"
              disabled={locked}
              onClick={() => save()}
            >
              {locked ? <LockKeyhole className="size-4" /> : <Check className="size-4" />}
              {hasRolled
                ? "Office roll saved"
                : !inChallenge
                  ? "Outside August 2026"
                  : !type
                    ? "No roll today"
                    : `Save ${distance === 0 ? "rest day" : `${distance} km`}`}
            </Button>
          )}
        </div>
        <Die value={savedValue ?? value} />
      </div>
    </Card>
  );
}
