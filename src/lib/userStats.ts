import type { User } from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type UserStats = {
  currentStreak: number;
  bestStreak: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
};

export type GameResult = "win" | "loss";

export const DEFAULT_USER_STATS: UserStats = {
  currentStreak: 0,
  bestStreak: 0,
  wins: 0,
  losses: 0,
  gamesPlayed: 0,
};

function sanitizeNumber(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function sanitizeStats(value: unknown): UserStats {
  if (!value || typeof value !== "object") {
    return DEFAULT_USER_STATS;
  }

  const candidate = value as Record<string, unknown>;

  return {
    currentStreak: sanitizeNumber(candidate.currentStreak),
    bestStreak: sanitizeNumber(candidate.bestStreak),
    wins: sanitizeNumber(candidate.wins),
    losses: sanitizeNumber(candidate.losses),
    gamesPlayed: sanitizeNumber(candidate.gamesPlayed),
  };
}

function computeNextStats(current: UserStats, result: GameResult): UserStats {
  const wins = current.wins + (result === "win" ? 1 : 0);
  const losses = current.losses + (result === "loss" ? 1 : 0);
  const currentStreak = result === "win" ? current.currentStreak + 1 : 0;

  return {
    currentStreak,
    bestStreak: Math.max(current.bestStreak, currentStreak),
    wins,
    losses,
    gamesPlayed: current.gamesPlayed + 1,
  };
}

export async function ensureUserDocument(user: User) {
  const firestore = db;
  if (!firestore) return;

  const userRef = doc(firestore, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      stats: DEFAULT_USER_STATS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await setDoc(
    userRef,
    {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function fetchUserStats(uid: string) {
  const firestore = db;
  if (!firestore) return DEFAULT_USER_STATS;

  const userRef = doc(firestore, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return DEFAULT_USER_STATS;
  }

  const data = snapshot.data() as Record<string, unknown>;
  return sanitizeStats(data.stats);
}

export async function recordGameResult(uid: string, result: GameResult) {
  const firestore = db;
  if (!firestore) return DEFAULT_USER_STATS;

  return runTransaction(firestore, async (transaction) => {
    const userRef = doc(firestore, "users", uid);
    const snapshot = await transaction.get(userRef);
    const rawStats = snapshot.exists()
      ? (snapshot.data() as Record<string, unknown>).stats
      : undefined;

    const currentStats = sanitizeStats(rawStats);
    const nextStats = computeNextStats(currentStats, result);

    transaction.set(
      userRef,
      {
        stats: nextStats,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return nextStats;
  });
}
