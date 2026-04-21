import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type DailyPuzzleProgress = {
  mistakes: number;
  solvedGroupIds: string[];
  guessHistory: string[][];
  statsCounted: boolean;
};

export const DEFAULT_DAILY_PUZZLE_PROGRESS: DailyPuzzleProgress = {
  mistakes: 0,
  solvedGroupIds: [],
  guessHistory: [],
  statsCounted: false,
};

const LOCAL_PROGRESS_PREFIX = "daily-puzzle-progress";

function sanitizeMistakes(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function sanitizeSolvedGroupIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const uniqueIds = new Set<string>();

  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      uniqueIds.add(item);
    }
  }

  return [...uniqueIds];
}

function sanitizeProgress(value: unknown): DailyPuzzleProgress {
  if (!value || typeof value !== "object") {
    return DEFAULT_DAILY_PUZZLE_PROGRESS;
  }

  const candidate = value as Record<string, unknown>;

  return {
    mistakes: sanitizeMistakes(candidate.mistakes),
    solvedGroupIds: sanitizeSolvedGroupIds(candidate.solvedGroupIds),
    guessHistory: sanitizeGuessHistory(candidate.guessHistory),
    statsCounted: candidate.statsCounted === true,
  };
}

function getProgressScore(progress: DailyPuzzleProgress) {
  return progress.solvedGroupIds.length * 100 + progress.guessHistory.length * 10 + progress.mistakes;
}

export function pickMoreAdvancedProgress(
  first: DailyPuzzleProgress,
  second: DailyPuzzleProgress
): DailyPuzzleProgress {
  const firstScore = getProgressScore(first);
  const secondScore = getProgressScore(second);

  return secondScore > firstScore ? second : first;
}

function sanitizeGuessHistory(value: unknown) {
  if (!Array.isArray(value)) return [];

  const sanitized: string[][] = [];

  for (const row of value) {
    if (!Array.isArray(row)) continue;

    const nextRow: string[] = [];
    for (const item of row) {
      if (typeof item === "string" && item.trim()) {
        nextRow.push(item);
      }
    }

    if (nextRow.length === 4) {
      sanitized.push(nextRow);
    }
  }

  return sanitized;
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalProgressStorageKey(uid: string, puzzleDate: string) {
  return `${LOCAL_PROGRESS_PREFIX}:${uid}:${puzzleDate}`;
}

export function readLocalDailyPuzzleProgress(uid: string, puzzleDate: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getLocalProgressStorageKey(uid, puzzleDate));
    if (!raw) return null;

    return sanitizeProgress(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalDailyPuzzleProgress(
  uid: string,
  puzzleDate: string,
  progress: DailyPuzzleProgress
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getLocalProgressStorageKey(uid, puzzleDate),
      JSON.stringify(sanitizeProgress(progress))
    );
  } catch {
    // localStorage can fail in private mode or quota exceeded; ignore.
  }
}

export async function fetchDailyPuzzleProgress(uid: string, puzzleDate: string) {
  const firestore = db;
  if (!firestore) return DEFAULT_DAILY_PUZZLE_PROGRESS;

  const progressRef = doc(firestore, "users", uid, "dailyProgress", puzzleDate);
  const snapshot = await getDoc(progressRef);

  if (!snapshot.exists()) {
    return DEFAULT_DAILY_PUZZLE_PROGRESS;
  }

  return sanitizeProgress(snapshot.data());
}

export async function saveDailyPuzzleProgress(
  uid: string,
  puzzleDate: string,
  progress: DailyPuzzleProgress
) {
  const firestore = db;
  if (!firestore) return;

  const progressRef = doc(firestore, "users", uid, "dailyProgress", puzzleDate);

  await setDoc(
    progressRef,
    {
      ...sanitizeProgress(progress),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
