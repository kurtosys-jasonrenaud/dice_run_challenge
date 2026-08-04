import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateStats,
  createChallengeEntry,
  ensureAugustScaffold,
  generateAugustCalendar,
  getAugustYear,
  getChallengeDate,
  getRollForDate,
  getRollType,
  isPendingRoll,
  mergeSharedTargets,
  normalizeRoll,
  toIsoDate,
} from "../lib/challenge";
import { fetchTargets } from "../lib/stravaApi";
import type {
  AugustGenerationResult,
  ChallengeRoll,
  DiceValue,
} from "../types/challenge";

const STORAGE_KEY = "roll-and-run:rolls:v1";
const META_KEY = "roll-and-run:meta:v1";

interface ChallengeMeta {
  augustGeneratedYear?: number;
  augustGeneratedAt?: string;
}

function readRolls(): ChallengeRoll[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) =>
      normalizeRoll(item as Partial<ChallengeRoll> & {
        challengeDate: string;
        distanceKm: number;
        type: ChallengeRoll["type"];
      }),
    );
  } catch {
    return [];
  }
}

function readMeta(): ChallengeMeta {
  try {
    const stored = localStorage.getItem(META_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as ChallengeMeta;
  } catch {
    return {};
  }
}

export function useChallenge(month: Date) {
  const [rolls, setRolls] = useState<ChallengeRoll[]>(readRolls);
  const [meta, setMeta] = useState<ChallengeMeta>(readMeta);

  const persist = useCallback((next: ChallengeRoll[]) => {
    setRolls(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const persistMeta = useCallback((next: ChallengeMeta) => {
    setMeta(next);
    localStorage.setItem(META_KEY, JSON.stringify(next));
  }, []);

  // Shared office targets are the source of truth across devices.
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromSharedTargets() {
      try {
        const { targets } = await fetchTargets();
        if (cancelled) return;

        const year = getAugustYear();
        const needsScaffold = readMeta().augustGeneratedYear !== year;

        setRolls((prev) => {
          let next = needsScaffold ? ensureAugustScaffold(prev, year).rolls : prev;
          next = mergeSharedTargets(next, targets);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });

        if (needsScaffold) {
          persistMeta({
            augustGeneratedYear: year,
            augustGeneratedAt: new Date().toISOString(),
          });
        }
      } catch {
        // Offline or API unavailable: keep whatever is already on this device.
      }
    }

    void hydrateFromSharedTargets();
    return () => {
      cancelled = true;
    };
  }, [persistMeta]);

  const rollForDate = useCallback(
    (rollDate: Date, value: DiceValue, distanceKm: number) => {
      const type = getRollType(rollDate);
      const challengeDate = getChallengeDate(rollDate);
      if (!type || !challengeDate) return null;

      const challengeIso = toIsoDate(challengeDate);
      if (
        rolls.some(
          (roll) =>
            roll.challengeDate === challengeIso &&
            roll.type !== "rest" &&
            !isPendingRoll(roll),
        )
      ) {
        return null;
      }

      const roll = createChallengeEntry({
        rollDate: toIsoDate(rollDate),
        challengeDate: challengeIso,
        diceValue: value,
        distanceKm,
        type,
        source: "manual",
      });

      const withoutConflict = rolls.filter(
        (entry) =>
          !(
            entry.challengeDate === challengeIso &&
            (entry.type === type || isPendingRoll(entry))
          ),
      );
      persist([...withoutConflict, roll]);
      return roll;
    },
    [persist, rolls],
  );

  const hasRolledFor = useCallback(
    (rollDate: Date) => {
      const challengeDate = getChallengeDate(rollDate);
      if (!challengeDate) return false;
      const challengeIso = toIsoDate(challengeDate);
      return rolls.some(
        (roll) =>
          roll.challengeDate === challengeIso &&
          roll.type !== "rest" &&
          !isPendingRoll(roll),
      );
    },
    [rolls],
  );

  const generateAugust = useCallback(
    (year = getAugustYear()): AugustGenerationResult => {
      const generated = generateAugustCalendar(year);
      const scaffolded = ensureAugustScaffold(rolls, year);
      persist(scaffolded.rolls);
      persistMeta({
        augustGeneratedYear: year,
        augustGeneratedAt: new Date().toISOString(),
      });
      return generated;
    },
    [persist, persistMeta, rolls],
  );

  const clearHistory = useCallback(() => {
    persist([]);
    persistMeta({});
  }, [persist, persistMeta]);

  const stats = useMemo(() => calculateStats(month, rolls), [month, rolls]);
  const current = useMemo(() => getRollForDate(rolls, new Date()), [rolls]);
  const next = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getRollForDate(rolls, tomorrow);
  }, [rolls]);

  const weekend = useMemo(() => {
    const now = new Date();
    const saturday = new Date(now);
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
    saturday.setDate(now.getDate() + daysUntilSaturday);
    return rolls.find(
      (roll) => roll.type === "weekend" && roll.challengeDate === toIsoDate(saturday),
    );
  }, [rolls]);

  return {
    rolls: [...rolls].sort((a, b) => b.challengeDate.localeCompare(a.challengeDate)),
    current,
    next,
    weekend,
    stats,
    meta,
    rollForDate,
    hasRolledFor,
    generateAugust,
    clearHistory,
  };
}
