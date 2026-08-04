import type {
  AugustGenerationResult,
  CalendarDay,
  ChallengeRoll,
  ChallengeSource,
  ChallengeStats,
  ChallengeType,
  DiceValue,
} from "../types/challenge";

export const WEEKDAY_DISTANCES: Record<DiceValue, number | [number, number]> = {
  1: 0,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: [4, 8],
};

export const WEEKEND_DISTANCES: Record<DiceValue, number> = {
  1: 0,
  2: 5,
  3: 6,
  4: 7,
  5: 8,
  6: 10,
};

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", options ?? {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function getRollType(date: Date): ChallengeType | null {
  const day = date.getDay();
  if (day === 5) return "weekend";
  if (day >= 1 && day <= 4) return "weekday";
  return null;
}

export function getChallengeDate(rollDate: Date): Date | null {
  const type = getRollType(rollDate);
  if (!type) return null;
  const challengeDate = new Date(rollDate);
  challengeDate.setDate(rollDate.getDate() + 1);
  return challengeDate;
}

export function getDistance(
  value: DiceValue,
  type: ChallengeType,
  choice?: 4 | 8,
): number | [number, number] {
  if (type === "weekend") return WEEKEND_DISTANCES[value];
  if (type === "rest") return 0;
  const distance = WEEKDAY_DISTANCES[value];
  return Array.isArray(distance) && choice ? choice : distance;
}

export function isPendingRoll(roll: ChallengeRoll): boolean {
  return roll.type !== "rest" && roll.diceValue === null;
}

export function getChallengeLabel(
  distance: number,
  type: ChallengeType,
  diceValue: DiceValue | null = null,
): string {
  if (type !== "rest" && diceValue === null) return "Pending";
  if (type === "rest" || distance === 0) {
    return type === "weekend" ? "Rest weekend" : "Rest day";
  }
  return `${distance} km`;
}

export function isInMonth(date: Date, year: number, monthIndex: number): boolean {
  return date.getFullYear() === year && date.getMonth() === monthIndex;
}

export function createChallengeEntry(input: {
  rollDate: string;
  challengeDate: string;
  diceValue: DiceValue | null;
  distanceKm: number;
  type: ChallengeType;
  source: ChallengeSource;
}): ChallengeRoll {
  return {
    id: crypto.randomUUID(),
    rollDate: input.rollDate,
    rolledAt: new Date().toISOString(),
    challengeDate: input.challengeDate,
    diceValue: input.diceValue,
    distanceKm: input.distanceKm,
    type: input.type,
    source: input.source,
  };
}

/**
 * Build an August challenge scaffold for office dice tracking:
 * Monday rest days plus pending weekday and weekend slots.
 * Distances stay empty until the real office roll is recorded.
 */
export function generateAugustCalendar(year: number): AugustGenerationResult {
  const entries: ChallengeRoll[] = [];
  const augustStart = new Date(year, 7, 1);
  const augustEnd = new Date(year, 7, 31);
  const scanStart = new Date(year, 6, 25);

  for (
    const cursor = new Date(augustStart);
    cursor <= augustEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    if (cursor.getDay() !== 1) continue;
    entries.push(
      createChallengeEntry({
        rollDate: "",
        challengeDate: toIsoDate(cursor),
        diceValue: null,
        distanceKm: 0,
        type: "rest",
        source: "generated",
      }),
    );
  }

  for (
    const cursor = new Date(scanStart);
    cursor <= augustEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const rollDate = new Date(cursor);
    const type = getRollType(rollDate);
    const challengeDate = getChallengeDate(rollDate);
    if (!type || !challengeDate) continue;

    if (type === "weekend") {
      const saturday = challengeDate;
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      const touchesAugust =
        isInMonth(saturday, year, 7) || isInMonth(sunday, year, 7);
      if (!touchesAugust) continue;

      entries.push(
        createChallengeEntry({
          rollDate: toIsoDate(rollDate),
          challengeDate: toIsoDate(saturday),
          diceValue: null,
          distanceKm: 0,
          type: "weekend",
          source: "generated",
        }),
      );
      continue;
    }

    if (!isInMonth(challengeDate, year, 7)) continue;

    entries.push(
      createChallengeEntry({
        rollDate: toIsoDate(rollDate),
        challengeDate: toIsoDate(challengeDate),
        diceValue: null,
        distanceKm: 0,
        type: "weekday",
        source: "generated",
      }),
    );
  }

  const restDays = entries.filter((entry) => entry.type === "rest").length;
  const weekdayChallenges = entries.filter((entry) => entry.type === "weekday").length;
  const weekendChallenges = entries.filter((entry) => entry.type === "weekend").length;

  return {
    year,
    entries,
    summary: {
      totalEntries: entries.length,
      restDays,
      weekdayChallenges,
      weekendChallenges,
      totalKm: 0,
    },
  };
}

export function normalizeRoll(raw: Partial<ChallengeRoll> & {
  challengeDate: string;
  distanceKm: number;
  type: ChallengeType;
}): ChallengeRoll {
  return {
    id: raw.id ?? crypto.randomUUID(),
    rollDate: raw.rollDate ?? "",
    rolledAt: raw.rolledAt ?? new Date().toISOString(),
    challengeDate: raw.challengeDate,
    diceValue: raw.diceValue ?? null,
    distanceKm: raw.distanceKm,
    type: raw.type,
    source: raw.source ?? "manual",
  };
}

/** Shared office target from the API, mapped into a local challenge roll. */
export function rollFromSharedTarget(target: {
  challengeDate: string;
  distanceKm: number;
  diceValue: number | null;
  type: ChallengeType;
  publishedAt?: string;
}): ChallengeRoll {
  const challenge = fromIsoDate(target.challengeDate);
  const rollDate = new Date(challenge);
  rollDate.setDate(challenge.getDate() - 1);

  return normalizeRoll({
    rollDate: target.type === "rest" ? "" : toIsoDate(rollDate),
    rolledAt: target.publishedAt,
    challengeDate: target.challengeDate,
    diceValue: target.diceValue as DiceValue | null,
    distanceKm: target.distanceKm,
    type: target.type,
    source: "manual",
  });
}

/**
 * Overlay shared office targets onto local rolls so every device sees the same
 * assigned distances. Confirmed shared targets win over pending local scaffold.
 */
export function mergeSharedTargets(
  rolls: ChallengeRoll[],
  targets: Array<{
    challengeDate: string;
    distanceKm: number;
    diceValue: number | null;
    type: ChallengeType;
    publishedAt?: string;
  }>,
): ChallengeRoll[] {
  if (targets.length === 0) return rolls;

  const byDate = new Map(rolls.map((roll) => [roll.challengeDate, roll]));
  for (const target of targets) {
    const incoming = rollFromSharedTarget(target);
    const existing = byDate.get(target.challengeDate);
    if (!existing) {
      byDate.set(target.challengeDate, incoming);
      continue;
    }
    byDate.set(target.challengeDate, {
      ...existing,
      diceValue: incoming.diceValue,
      distanceKm: incoming.distanceKm,
      type: incoming.type,
      source: "manual",
      rolledAt: incoming.rolledAt,
      rollDate: incoming.rollDate || existing.rollDate,
    });
  }
  return [...byDate.values()];
}

/** Ensure August scaffold exists, keeping any already-confirmed rolls. */
export function ensureAugustScaffold(
  rolls: ChallengeRoll[],
  year = getAugustYear(),
): { rolls: ChallengeRoll[]; generated: boolean } {
  const generated = generateAugustCalendar(year);
  const retained = rolls.filter((roll) => !challengeTouchesAugust(roll, year));
  const scaffold = new Map(
    generated.entries.map((entry) => [entry.challengeDate, entry]),
  );

  for (const roll of rolls) {
    if (!challengeTouchesAugust(roll, year)) continue;
    const existing = scaffold.get(roll.challengeDate);
    if (!existing || !isPendingRoll(roll)) {
      scaffold.set(roll.challengeDate, roll);
    }
  }

  return {
    rolls: [...retained, ...scaffold.values()],
    generated: true,
  };
}

export function getRollForDate(
  rolls: ChallengeRoll[],
  date: Date,
): ChallengeRoll | undefined {
  const day = date.getDay();
  if (day === 0) {
    const saturday = new Date(date);
    saturday.setDate(date.getDate() - 1);
    return rolls.find(
      (roll) => roll.type === "weekend" && roll.challengeDate === toIsoDate(saturday),
    );
  }
  return rolls.find((roll) => roll.challengeDate === toIsoDate(date));
}

export function getCalendarDays(month: Date, rolls: ChallengeRoll[]): CalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  const sundayOffset = (7 - last.getDay()) % 7;
  const end = new Date(last);
  end.setDate(last.getDate() + sundayOffset);
  const today = toIsoDate(new Date());
  const days: CalendarDay[] = [];

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    const iso = toIsoDate(date);
    days.push({
      date,
      iso,
      inMonth: date.getMonth() === month.getMonth(),
      isToday: iso === today,
      isMonday: date.getDay() === 1,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      roll: getRollForDate(rolls, date),
    });
  }

  return days;
}

export function calculateStats(month: Date, rolls: ChallengeRoll[]): ChallengeStats {
  const monthRolls = rolls.filter((roll) => {
    const date = fromIsoDate(roll.challengeDate);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  });

  const confirmed = monthRolls.filter((roll) => !isPendingRoll(roll));
  const restEntries = confirmed.filter(
    (roll) => roll.type === "rest" || roll.distanceKm === 0,
  );
  const mondayCount = getCalendarDays(month, []).filter(
    (day) => day.inMonth && day.isMonday,
  ).length;
  const hasExplicitRests = monthRolls.some((roll) => roll.type === "rest");
  const runRolls = confirmed.filter((roll) => roll.distanceKm > 0);
  const totalKm = runRolls.reduce((sum, roll) => sum + roll.distanceKm, 0);

  return {
    totalKm,
    runDays: runRolls.length,
    restDays: hasExplicitRests ? restEntries.length : mondayCount + restEntries.length,
    averageDistance: runRolls.length ? totalKm / runRolls.length : 0,
    longestChallenge: runRolls.length
      ? Math.max(...runRolls.map((roll) => roll.distanceKm))
      : 0,
    weekendChallenges: confirmed.filter((roll) => roll.type === "weekend").length,
  };
}

export const CHALLENGE_YEAR = 2026;
export const CHALLENGE_MONTH = 7; // August (0-indexed)
export const CHALLENGE_LABEL = "August 2026";

export function getChallengeMonth(): Date {
  return new Date(CHALLENGE_YEAR, CHALLENGE_MONTH, 1);
}

export function getAugustYear(): number {
  return CHALLENGE_YEAR;
}

export function challengeTouchesAugust(
  roll: ChallengeRoll,
  year: number = CHALLENGE_YEAR,
): boolean {
  const challenge = fromIsoDate(roll.challengeDate);
  if (isInMonth(challenge, year, CHALLENGE_MONTH)) return true;
  if (roll.type === "weekend") {
    const sunday = new Date(challenge);
    sunday.setDate(challenge.getDate() + 1);
    return isInMonth(sunday, year, CHALLENGE_MONTH);
  }
  return false;
}

/** True when today's office roll sets an August 2026 challenge day. */
export function rollAppliesToChallenge(rollDate: Date): boolean {
  const challengeDate = getChallengeDate(rollDate);
  const type = getRollType(rollDate);
  if (!challengeDate || !type) return false;

  if (type === "weekend") {
    const sunday = new Date(challengeDate);
    sunday.setDate(challengeDate.getDate() + 1);
    return (
      isInMonth(challengeDate, CHALLENGE_YEAR, CHALLENGE_MONTH) ||
      isInMonth(sunday, CHALLENGE_YEAR, CHALLENGE_MONTH)
    );
  }

  return isInMonth(challengeDate, CHALLENGE_YEAR, CHALLENGE_MONTH);
}
