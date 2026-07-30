export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;
export type ChallengeType = "weekday" | "weekend" | "rest";
export type ChallengeSource = "manual" | "generated";
export type Theme = "light" | "dark";

export interface ChallengeRoll {
  id: string;
  /** Calendar date the die was rolled (YYYY-MM-DD). Empty for fixed Monday rest days. */
  rollDate: string;
  /** Timestamp when the entry was saved. */
  rolledAt: string;
  /** Date the distance applies to (YYYY-MM-DD). Weekend entries use Saturday. */
  challengeDate: string;
  diceValue: DiceValue | null;
  distanceKm: number;
  type: ChallengeType;
  source: ChallengeSource;
}

export interface ChallengeStats {
  totalKm: number;
  runDays: number;
  restDays: number;
  averageDistance: number;
  longestChallenge: number;
  weekendChallenges: number;
}

export interface CalendarDay {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  isMonday: boolean;
  isWeekend: boolean;
  roll?: ChallengeRoll;
}

export interface AugustGenerationResult {
  year: number;
  entries: ChallengeRoll[];
  summary: {
    totalEntries: number;
    restDays: number;
    weekdayChallenges: number;
    weekendChallenges: number;
    totalKm: number;
  };
}
