import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import clsx from "clsx";
import { Cog6ToothIcon } from "@heroicons/react/24/solid";
import { motion } from "motion/react";
import { FcGoogle } from "react-icons/fc";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  identifierToEmail,
  normalizeUsername,
  usernameFromEmail,
  usernameToEmail,
} from "./lib/auth";
import { auth, ensureAuthPersistence } from "./lib/firebase";
import { createTiles, loadPuzzle, type Group, type PuzzleWord } from "./lib/puzzle";
import {
  DEFAULT_USER_STATS,
  ensureUserDocument,
  fetchUserStats,
  recordGameResult,
  type GameResult,
  type UserStats,
} from "./lib/userStats";
import {
  fetchDailyPuzzleProgress,
  pickMoreAdvancedProgress,
  readLocalDailyPuzzleProgress,
  saveDailyPuzzleProgress,
  writeLocalDailyPuzzleProgress,
} from "./lib/userProgress";

type Language = "ar" | "en";
type AuthMode = "signin" | "signup";
type AuthStatus = "checking" | "signed_in" | "signed_out" | "disabled";

type Tile = {
  id: string;
  word: PuzzleWord;
  groupId: string;
};

const MAX_MISTAKES = 4;

const secondaryButtonClass =
  "h-12 rounded-full border border-[#121212] bg-white px-5 text-[0.98rem] font-semibold text-[#121212] transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-white disabled:text-stone-400";

const primaryButtonClass =
  "h-12 rounded-full border border-[#5a594e] bg-[#5a594e] px-5 text-[0.98rem] font-semibold text-white transition hover:bg-[#4e4d44] disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400 disabled:text-white/80";

const googleButtonClass =
  "h-12 w-full rounded-full border-2 border-stone-500 bg-[#f4f4f2] px-5 text-[0.98rem] font-semibold text-[#232329] transition hover:bg-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400";

const authInputClass =
  "h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[0.95rem] text-[#121212] outline-none transition focus:border-stone-500";

const COPY: Record<
  Language,
  {
    title: string;
    loadingHeading: string;
    loadingCard: string;
    errorHeading: string;
    errorCard: string;
    winMessage: string;
    loseMessage: string;
    introMessage: string;
    mistakesRemaining: string;
    shuffle: string;
    clearSelection: string;
    submit: string;
    playAgain: string;
    authChecking: string;
    authDisabled: string;
    authHint: string;
    signIn: string;
    signUp: string;
    continueWithGoogle: string;
    usernameOrEmail: string;
    username: string;
    password: string;
    signInAction: string;
    signUpAction: string;
    signedInAs: string;
    account: string;
    accountTitle: string;
    close: string;
    signOut: string;
    playerFallback: string;
    completedGames: string;
    winRate: string;
    currentStreak: string;
    maxStreak: string;
    streak: string;
    bestStreak: string;
    wins: string;
    losses: string;
    games: string;
    statsSyncing: string;
    statsSyncError: string;
    progressLoading: string;
    perfectTitle: string;
    solvedTitle: string;
    lostTitle: string;
    closeResults: string;
    shareResults: string;
    shareFallbackOpened: string;
    shareError: string;
  }
> = {
  ar: {
    title: "وصلات",
    loadingHeading: "عم نحضّر اللعبة...",
    loadingCard: "عم نحمّل الكلمات...",
    errorHeading: "صار في مشكلة بتحميل اللعبة.",
    errorCard:
      "ما قدرنا نجيب بيانات اللعبة. تأكد من `VITE_PUZZLE_API_URL` أو من الملف `/public/puzzle.json`.",
    winMessage: "أحسنت! لقيت كل المجموعات.",
    loseMessage: "خلصت المحاولات. هيدي كل المجموعات.",
    introMessage: "كوّن أربع مجموعات من أربع كلمات!",
    mistakesRemaining: "المحاولات المتبقية:",
    shuffle: "خلط",
    clearSelection: "مسح التحديد",
    submit: "تأكيد",
    playAgain: "العب من جديد",
    authChecking: "عم نتحقق من تسجيل الدخول...",
    authDisabled: "تسجيل الدخول مش مفعّل. ضيف إعدادات Firebase لتفعيل الحسابات وحفظ السجل.",
    authHint: "سجّل دخولك لتحفظ سجل الفوز على حسابك.",
    signIn: "دخول",
    signUp: "إنشاء حساب",
    continueWithGoogle: "المتابعة مع Google",
    usernameOrEmail: "اسم المستخدم أو البريد",
    username: "اسم المستخدم",
    password: "كلمة السر",
    signInAction: "تسجيل الدخول",
    signUpAction: "إنشاء الحساب",
    signedInAs: "مسجّل باسم",
    account: "الحساب",
    accountTitle: "إحصائياتي",
    close: "إغلاق",
    signOut: "تسجيل الخروج",
    playerFallback: "لاعب",
    completedGames: "مكتملة",
    winRate: "نسبة الفوز",
    currentStreak: "السلسلة الحالية",
    maxStreak: "أعلى سلسلة",
    streak: "السلسلة",
    bestStreak: "أفضل سلسلة",
    wins: "فوز",
    losses: "خسارة",
    games: "ألعاب",
    statsSyncing: "عم نحفظ النتيجة...",
    statsSyncError: "ما قدرنا نحفظ النتيجة هالمرة.",
    progressLoading: "عم نرجّع تقدمك...",
    perfectTitle: "مثالية!",
    solvedTitle: "خلصتها!",
    lostTitle: "انتهت اللعبة",
    closeResults: "إغلاق",
    shareResults: "مشاركة",
    shareFallbackOpened: "فتحنا واتساب. إذا ما انبعت الصورة تلقائياً، نزّلها وأرفقها.",
    shareError: "ما قدرنا نجهّز الصورة للمشاركة.",
  },
  en: {
    title: "Connections",
    loadingHeading: "Getting the puzzle ready...",
    loadingCard: "Loading words...",
    errorHeading: "There was a problem loading the game.",
    errorCard:
      "We couldn't load the puzzle data. Check `VITE_PUZZLE_API_URL` or `/public/puzzle.json`.",
    winMessage: "Nice work. You found all the groups.",
    loseMessage: "No more mistakes left. Here are all the groups.",
    introMessage: "Create four groups of four!",
    mistakesRemaining: "Mistakes remaining:",
    shuffle: "Shuffle",
    clearSelection: "Deselect All",
    submit: "Submit",
    playAgain: "Play Again",
    authChecking: "Checking sign-in...",
    authDisabled: "Sign-in is disabled. Add Firebase config to enable accounts and saved streaks.",
    authHint: "Sign in to keep your streak on your account.",
    signIn: "Sign In",
    signUp: "Sign Up",
    continueWithGoogle: "Continue with Google",
    usernameOrEmail: "Username or email",
    username: "Username",
    password: "Password",
    signInAction: "Sign In",
    signUpAction: "Create Account",
    signedInAs: "Signed in as",
    account: "Account",
    accountTitle: "My Stats",
    close: "Close",
    signOut: "Sign Out",
    playerFallback: "Player",
    completedGames: "Completed",
    winRate: "Win %",
    currentStreak: "Current Streak",
    maxStreak: "Max Streak",
    streak: "Streak",
    bestStreak: "Best",
    wins: "Wins",
    losses: "Losses",
    games: "Games",
    statsSyncing: "Saving game result...",
    statsSyncError: "Couldn't save this result.",
    progressLoading: "Restoring your progress...",
    perfectTitle: "Perfect!",
    solvedTitle: "Solved!",
    lostTitle: "Game Over",
    closeResults: "Close",
    shareResults: "Share",
    shareFallbackOpened:
      "Opened WhatsApp. If image attachment is not automatic, download and attach it manually.",
    shareError: "Couldn't prepare the image for sharing.",
  },
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getWordLines(word: PuzzleWord, language: Language) {
  if (language === "en") {
    return {
      primary: word.arabeezy ?? word.arabic,
      secondary: undefined,
      primaryDir: word.arabeezy ? "ltr" : "rtl",
      secondaryDir: "rtl" as const,
    };
  }

  return {
    primary: word.arabic,
    secondary: undefined,
    primaryDir: "rtl" as const,
    secondaryDir: "ltr" as const,
  };
}

function getTilePrimaryClass(language: Language) {
  if (language === "ar") {
    return "text-[clamp(1.18rem,3.35vw,1.52rem)]";
  }

  return "text-[clamp(1.08rem,3vw,1.4rem)]";
}

function getGroupTitle(group: Group, language: Language) {
  if (language === "en") {
    return group.title.en ?? group.title.ar;
  }

  return group.title.ar;
}

function getGroupWordsText(group: Group, language: Language) {
  const separator = language === "ar" ? "، " : ", ";
  return group.words.map((word) => getWordLines(word, language).primary).join(separator);
}

function getGroupTitleSizeClass(group: Group, language: Language) {
  const titleLength = getGroupTitle(group, language).trim().length;

  if (titleLength >= 34) {
    return "text-[clamp(0.72rem,2.25vw,1rem)]";
  }

  if (titleLength >= 27) {
    return "text-[clamp(0.82rem,2.35vw,1.14rem)]";
  }

  if (titleLength >= 20) {
    return "text-[clamp(0.94rem,2.4vw,1.28rem)]";
  }

  return "text-[clamp(1.05rem,2.4vw,1.5rem)]";
}

function getAuthErrorMessage(error: unknown, language: Language) {
  const isArabic = language === "ar";

  if (error instanceof Error) {
    if (error.message === "invalid_username") {
      return isArabic
        ? "اسم المستخدم لازم يكون بين 3 و24 حرف (a-z, 0-9, . _ -)."
        : "Username must be 3-24 chars and use a-z, 0-9, . _ -.";
    }

    if (error.message === "invalid_identifier") {
      return isArabic
        ? "أدخل اسم مستخدم أو بريد إلكتروني صالح."
        : "Enter a valid username or email.";
    }
  }

  if (!(error instanceof FirebaseError)) {
    return isArabic
      ? "ما قدرنا نكمل عملية تسجيل الدخول."
      : "We couldn't complete sign-in.";
  }

  switch (error.code) {
    case "auth/popup-closed-by-user":
      return isArabic ? "سكرِت نافذة Google قبل ما تكمّل." : "Google sign-in popup was closed.";
    case "auth/account-exists-with-different-credential":
      return isArabic
        ? "في حساب بنفس البريد على طريقة تسجيل مختلفة."
        : "An account already exists with a different sign-in method.";
    case "auth/email-already-in-use":
      return isArabic ? "اسم المستخدم مستخدم من قبل." : "That username is already taken.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return isArabic
        ? "بيانات الدخول غير صحيحة."
        : "Incorrect login credentials.";
    case "auth/weak-password":
      return isArabic
        ? "كلمة السر ضعيفة. لازم تكون 6 أحرف أو أكثر."
        : "Password is too weak. Use at least 6 characters.";
    case "auth/too-many-requests":
      return isArabic
        ? "في محاولات كثيرة. جرّب بعد شوي."
        : "Too many attempts. Try again in a bit.";
    default:
      return isArabic
        ? "ما قدرنا نكمل عملية تسجيل الدخول."
        : "We couldn't complete sign-in.";
  }
}

function getUserLabel(user: User | null, fallback: string) {
  if (!user) return fallback;
  return user.displayName ?? usernameFromEmail(user.email) ?? fallback;
}

function splitIntoLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return [text];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.arcTo(x + width, y, x + width, y + r, r);
  context.lineTo(x + width, y + height - r);
  context.arcTo(x + width, y + height, x + width - r, y + height, r);
  context.lineTo(x + r, y + height);
  context.arcTo(x, y + height, x, y + height - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function toTiles(groups: Group[]): Tile[] {
  return createTiles(groups).map((tile, index) => ({
    ...tile,
    id: `${tile.groupId}-${index}`,
  }));
}

export default function App() {
  const [language, setLanguage] = useState<Language>("ar");
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [puzzleProgressKey, setPuzzleProgressKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [solvedGroupIds, setSolvedGroupIds] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [guessHistory, setGuessHistory] = useState<string[][]>([]);
  const [gameRound, setGameRound] = useState(0);

  const [authStatus, setAuthStatus] = useState<AuthStatus>(auth ? "checking" : "disabled");
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const [signInIdentifier, setSignInIdentifier] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  const [userStats, setUserStats] = useState<UserStats>(DEFAULT_USER_STATS);
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [isDailyProgressLoaded, setIsDailyProgressLoaded] = useState(false);
  const [isStatsCountedForDay, setIsStatsCountedForDay] = useState(false);

  const recordedRoundRef = useRef<number | null>(null);
  const openedResultsRoundRef = useRef<number | null>(null);
  const hasHydratedDailyProgressRef = useRef(false);
  const dailyProgressKeyRef = useRef<string | null>(null);

  const copy = COPY.en;
  const isArabic = language === "ar";
  const englishFontClass = "font-ui-en";
  const puzzleWordFontClass = isArabic ? "font-ui-ar" : "font-ui-en";

  useEffect(() => {
    let isActive = true;

    const initializeGame = async () => {
      try {
        const nextPuzzle = await loadPuzzle();
        if (!isActive) return;

        const nextGroups = nextPuzzle.groups;
        setPuzzleProgressKey(nextPuzzle.puzzleId);
        setGroups(nextGroups);
        setTiles(shuffle(toTiles(nextGroups)));
        setSelected([]);
        setSolvedGroupIds([]);
        setMistakes(0);
        setShakeKey(0);
        setGuessHistory([]);
        setIsStatsCountedForDay(false);
        setIsResultsOpen(false);
        setShareMessage(null);
        setShareBusy(false);
        openedResultsRoundRef.current = null;
        hasHydratedDailyProgressRef.current = false;
        dailyProgressKeyRef.current = null;
        setIsDailyProgressLoaded(false);
        setGameRound((prev) => prev + 1);
        setStatus("ready");
      } catch {
        if (!isActive) return;
        setStatus("error");
      }
    };

    initializeGame();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!auth) return;

    let isActive = true;

    ensureAuthPersistence().catch(() => {
      if (!isActive) return;
      setAuthError(getAuthErrorMessage(new Error("persistence_failed"), "en"));
    });

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!isActive) return;

      setAuthUser(nextUser);
      setAuthError(null);

      if (!nextUser) {
        setAuthStatus("signed_out");
        setUserStats(DEFAULT_USER_STATS);
        setStatsBusy(false);
        setStatsError(false);
        setSelected([]);
        setSolvedGroupIds([]);
        setMistakes(0);
        setGuessHistory([]);
        setIsStatsCountedForDay(false);
        setIsResultsOpen(false);
        setShareMessage(null);
        setShareBusy(false);
        openedResultsRoundRef.current = null;
        setIsDailyProgressLoaded(false);
        hasHydratedDailyProgressRef.current = false;
        dailyProgressKeyRef.current = null;
        setIsAccountPanelOpen(false);
        recordedRoundRef.current = null;
        return;
      }

      setAuthStatus("signed_in");
      setStatsBusy(true);
      setStatsError(false);

      try {
        await ensureUserDocument(nextUser);
        const nextStats = await fetchUserStats(nextUser.uid);
        if (!isActive) return;
        setUserStats(nextStats);
      } catch {
        if (!isActive) return;
        setStatsError(true);
      } finally {
        if (isActive) {
          setStatsBusy(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authStatus !== "signed_in" || !authUser || status !== "ready" || !puzzleProgressKey) return;

    const currentScopeKey = `${authUser.uid}:${puzzleProgressKey}`;
    if (dailyProgressKeyRef.current === currentScopeKey && isDailyProgressLoaded) return;

    let isActive = true;
    setIsDailyProgressLoaded(false);
    hasHydratedDailyProgressRef.current = false;

    const applyProgress = (progress: {
      mistakes: number;
      solvedGroupIds: string[];
      guessHistory: string[][];
      statsCounted: boolean;
    }) => {
      const validGroupIds = new Set(groups.map((group) => group.id));
      const nextSolvedGroupIds = progress.solvedGroupIds.filter((groupId) => validGroupIds.has(groupId));
      const nextGuessHistory = progress.guessHistory.filter(
        (guess) => guess.length === 4 && guess.every((groupId) => validGroupIds.has(groupId))
      );

      setMistakes(progress.mistakes);
      setSolvedGroupIds(nextSolvedGroupIds);
      setGuessHistory(nextGuessHistory);
      setIsStatsCountedForDay(progress.statsCounted);
      setSelected([]);
      setShakeKey(0);
    };

    const localProgress = readLocalDailyPuzzleProgress(authUser.uid, puzzleProgressKey);

    fetchDailyPuzzleProgress(authUser.uid, puzzleProgressKey)
      .then((progress) => {
        if (!isActive) return;

        const mergedProgress = localProgress
          ? pickMoreAdvancedProgress(progress, localProgress)
          : progress;

        applyProgress(mergedProgress);
        setIsDailyProgressLoaded(true);
        hasHydratedDailyProgressRef.current = true;
        dailyProgressKeyRef.current = currentScopeKey;
      })
      .catch(() => {
        if (!isActive) return;

        if (localProgress) {
          applyProgress(localProgress);
          hasHydratedDailyProgressRef.current = true;
        } else {
          hasHydratedDailyProgressRef.current = false;
        }

        setIsDailyProgressLoaded(true);
        dailyProgressKeyRef.current = currentScopeKey;
      });

    return () => {
      isActive = false;
    };
  }, [authStatus, authUser, groups, isDailyProgressLoaded, puzzleProgressKey, status]);

  useEffect(() => {
    if (authStatus !== "signed_in" || !authUser || status !== "ready" || !puzzleProgressKey) return;
    if (!isDailyProgressLoaded || !hasHydratedDailyProgressRef.current) return;

    const nextProgress = {
      mistakes,
      solvedGroupIds,
      guessHistory,
      statsCounted: isStatsCountedForDay,
    };

    writeLocalDailyPuzzleProgress(authUser.uid, puzzleProgressKey, nextProgress);

    saveDailyPuzzleProgress(authUser.uid, puzzleProgressKey, nextProgress).catch(() => {
      // Keep gameplay responsive; daily progress persistence is best-effort.
    });
  }, [
    authStatus,
    authUser,
    isDailyProgressLoaded,
    guessHistory,
    isStatsCountedForDay,
    mistakes,
    puzzleProgressKey,
    solvedGroupIds,
    status,
  ]);

  const solvedGroups = groups.filter((group) => solvedGroupIds.includes(group.id));
  const isWon = groups.length > 0 && solvedGroupIds.length === groups.length;
  const isLost = mistakes >= MAX_MISTAKES && !isWon;
  const hasFinished = isWon || isLost;
  const visibleSolvedGroups = isLost ? groups : solvedGroups;
  const unsolvedTiles = hasFinished
    ? []
    : tiles.filter((tile) => !solvedGroupIds.includes(tile.groupId));
  const remainingMistakes = Math.max(MAX_MISTAKES - mistakes, 0);

  useEffect(() => {
    if (status !== "ready" || !hasFinished) return;
    if (openedResultsRoundRef.current === gameRound) return;

    openedResultsRoundRef.current = gameRound;
    setShareMessage(null);
    setIsResultsOpen(true);
  }, [gameRound, hasFinished, status]);

  useEffect(() => {
    if (status !== "ready" || !hasFinished || !authUser) return;
    if (!isDailyProgressLoaded || isStatsCountedForDay) return;
    if (recordedRoundRef.current === gameRound) return;

    recordedRoundRef.current = gameRound;

    let isActive = true;
    const result: GameResult = isWon ? "win" : "loss";

    setStatsBusy(true);
    setStatsError(false);

    recordGameResult(authUser.uid, result)
      .then((nextStats) => {
        if (!isActive) return;
        setUserStats(nextStats);
        setIsStatsCountedForDay(true);
      })
      .catch(() => {
        if (!isActive) return;
        setStatsError(true);
      })
      .finally(() => {
        if (!isActive) return;
        setStatsBusy(false);
      });

    return () => {
      isActive = false;
    };
  }, [authUser, gameRound, hasFinished, isDailyProgressLoaded, isStatsCountedForDay, isWon, status]);

  const toggleWord = (tileId: string) => {
    if (hasFinished) return;

    if (selected.includes(tileId)) {
      setSelected((prev) => prev.filter((item) => item !== tileId));
      return;
    }

    if (selected.length >= 4) return;
    setSelected((prev) => [...prev, tileId]);
  };

  const submitGuess = () => {
    if (selected.length !== 4 || hasFinished) return;

    if (!hasHydratedDailyProgressRef.current) {
      hasHydratedDailyProgressRef.current = true;
    }

    const tileMap = new Map(tiles.map((tile) => [tile.id, tile]));
    const selectedTiles = selected
      .map((tileId) => tileMap.get(tileId))
      .filter((tile): tile is Tile => Boolean(tile));

    if (selectedTiles.length !== 4) return;

    setGuessHistory((prev) => [...prev, selectedTiles.map((tile) => tile.groupId)]);

    const firstGroupId = selectedTiles[0]?.groupId;
    const isCorrect = selectedTiles.every((tile) => tile.groupId === firstGroupId);

    if (isCorrect && firstGroupId && !solvedGroupIds.includes(firstGroupId)) {
      setSolvedGroupIds((prev) => [...prev, firstGroupId]);
      setSelected([]);
      return;
    }

    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    setShakeKey((prev) => prev + 1);
    setSelected([]);
  };

  const clearSelection = () => setSelected([]);

  const shuffleBoard = () => {
    if (hasFinished) return;
    setTiles((prev) => shuffle(prev));
  };

  const handleGoogleSignIn = async () => {
    if (!auth) return;

    setAuthBusy(true);
    setAuthError(null);

    try {
      await ensureAuthPersistence();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      await ensureUserDocument(credential.user);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, "en"));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth) return;

    setAuthBusy(true);
    setAuthError(null);

    try {
      await ensureAuthPersistence();
      const email = identifierToEmail(signInIdentifier);
      await signInWithEmailAndPassword(auth, email, signInPassword);
      setSignInPassword("");
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, "en"));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth) return;

    setAuthBusy(true);
    setAuthError(null);

    try {
      await ensureAuthPersistence();
      const normalizedUsername = normalizeUsername(signUpUsername);
      const email = usernameToEmail(normalizedUsername);
      const credential = await createUserWithEmailAndPassword(auth, email, signUpPassword);
      await updateProfile(credential.user, { displayName: normalizedUsername });
      await ensureUserDocument(credential.user);
      setSignUpPassword("");
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, "en"));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;

    setAuthBusy(true);
    setAuthError(null);
    setIsAccountPanelOpen(false);

    try {
      await firebaseSignOut(auth);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, "en"));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleShareResults = async () => {
    if (shareBusy) return;

    setShareBusy(true);
    setShareMessage(null);

    try {
      const width = 1080;
      const statsTop = 290;
      const statsBottom = 560;
      const gridTop = 640;
      const squareSize = 86;
      const squareGap = 12;
      const rowGap = 12;
      const gridRows = guessHistory.length;
      const gridHeight = gridRows > 0 ? gridRows * squareSize + (gridRows - 1) * rowGap : 0;
      const height = Math.max(980, gridTop + gridHeight + 120);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("canvas_not_supported");
      }

      context.fillStyle = "#f2f1ee";
      context.fillRect(0, 0, width, height);

      context.textAlign = "center";
      context.fillStyle = "#121212";
      context.font =
        '900 118px "IBM Plex Sans Arabic", "Noto Sans Arabic", "Aptos", "Segoe UI", sans-serif';
      context.fillText(resultTitle, width / 2, 180);

      context.fillStyle = "#57534e";
      context.font = '500 48px "IBM Plex Sans Arabic", "Noto Sans Arabic", "Aptos", sans-serif';
      context.fillText(copy.title, width / 2, 245);

      context.strokeStyle = "#78716c";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(120, statsTop);
      context.lineTo(width - 120, statsTop);
      context.moveTo(120, statsBottom);
      context.lineTo(width - 120, statsBottom);
      context.stroke();

      const statValues = [String(userStats.gamesPlayed), String(winRate), String(userStats.currentStreak), String(userStats.bestStreak)];
      const statLabels = [copy.completedGames, copy.winRate, copy.currentStreak, copy.maxStreak];
      const columnWidth = width / 4;

      for (let index = 0; index < 4; index += 1) {
        const x = columnWidth * index + columnWidth / 2;

        context.fillStyle = "#121212";
        context.font = '500 72px "IBM Plex Sans Arabic", "Noto Sans Arabic", "Aptos", sans-serif';
        context.fillText(statValues[index] ?? "0", x, 410);

        context.fillStyle = "#44403c";
        context.font = '500 40px "IBM Plex Sans Arabic", "Noto Sans Arabic", "Aptos", sans-serif';
        const lines = splitIntoLines(context, statLabels[index] ?? "", columnWidth - 28);
        lines.forEach((line, lineIndex) => {
          context.fillText(line, x, 470 + lineIndex * 44);
        });
      }

      if (gridRows > 0) {
        const gridWidth = squareSize * 4 + squareGap * 3;
        const startX = (width - gridWidth) / 2;

        guessHistory.forEach((guess, rowIndex) => {
          const y = gridTop + rowIndex * (squareSize + rowGap);

          guess.forEach((groupId, colIndex) => {
            const x = startX + colIndex * (squareSize + squareGap);
            context.fillStyle = colorByGroupId.get(groupId) ?? "#d6d3d1";
            drawRoundedRect(context, x, y, squareSize, squareSize, 10);
            context.fill();
          });
        });
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      const fallbackBlob = await fetch(canvas.toDataURL("image/png")).then((response) => response.blob());
      const finalBlob = blob ?? fallbackBlob;

      const file = new File([finalBlob], `connections-${puzzleProgressKey ?? "puzzle"}.png`, {
        type: "image/png",
      });
      const shareText = `${copy.title}\n${resultTitle}\n${copy.completedGames}: ${userStats.gamesPlayed} • ${copy.winRate}: ${winRate}%`;

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      const canShareFiles =
        typeof nav.share === "function" &&
        (typeof nav.canShare !== "function" || nav.canShare({ files: [file] }));

      if (canShareFiles) {
        await nav.share({
          files: [file],
          title: copy.title,
          text: shareText,
        });
        return;
      }

      const objectUrl = URL.createObjectURL(finalBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
      setShareMessage(copy.shareFallbackOpened);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Share image generation failed", error);
      setShareMessage(copy.shareError);
    } finally {
      setShareBusy(false);
    }
  };

  const userLabel = getUserLabel(authUser, copy.playerFallback);
  const isSignedIn = authStatus === "signed_in" && authUser !== null;
  const shouldGateGame = authStatus === "checking" || authStatus === "signed_out";
  const isDailyProgressLoading = isSignedIn && status === "ready" && !isDailyProgressLoaded;
  const winRate = userStats.gamesPlayed > 0 ? Math.round((userStats.wins / userStats.gamesPlayed) * 100) : 0;
  const resultTitle = isWon ? (mistakes === 0 ? copy.perfectTitle : copy.solvedTitle) : copy.lostTitle;
  const colorByGroupId = new Map(groups.map((group) => [group.id, group.solvedColor] as const));

  if (shouldGateGame) {
    return (
      <div dir="ltr" className="min-h-dvh bg-[#f7f6f3] text-[#121212]">
        <main className="mx-auto flex min-h-dvh w-full max-w-[36rem] flex-col justify-center px-4 py-6 sm:px-5 sm:py-10">
          <header className="mb-6 text-center sm:mb-7">
            <h1
              className={clsx(
                "text-[clamp(1.65rem,4vw,2.15rem)] tracking-tight font-semibold",
                englishFontClass
              )}
            >
              {copy.title}
            </h1>
          </header>

          <section className="rounded-[1.2rem] bg-[#efede6] px-5 py-6 sm:px-7 sm:py-7">
            {authStatus === "checking" ? (
              <p className={clsx("text-center text-stone-700", englishFontClass)}>{copy.authChecking}</p>
            ) : (
              <div className="space-y-5 sm:space-y-6">
                <p
                  className={clsx(
                    "mx-auto max-w-[27rem] text-center text-[1rem] leading-relaxed text-stone-700",
                    englishFontClass
                  )}
                >
                  {copy.authHint}
                </p>

                <div className="flex justify-center">
                  <div className="inline-flex rounded-full bg-[#e4dfd1] p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setAuthError(null);
                      }}
                      className={clsx(
                        "rounded-full px-6 py-2.5 text-sm font-semibold transition",
                        englishFontClass,
                        authMode === "signin"
                          ? "bg-[#5a594e] text-white shadow-sm"
                          : "text-stone-600 hover:text-stone-800"
                      )}
                    >
                      {copy.signIn}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError(null);
                      }}
                      className={clsx(
                        "rounded-full px-6 py-2.5 text-sm font-semibold transition",
                        englishFontClass,
                        authMode === "signup"
                          ? "bg-[#5a594e] text-white shadow-sm"
                          : "text-stone-600 hover:text-stone-800"
                      )}
                    >
                      {copy.signUp}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authBusy}
                  className={clsx(
                    googleButtonClass,
                    "inline-flex items-center justify-center gap-3",
                    englishFontClass
                  )}
                >
                  <FcGoogle aria-hidden className="h-6 w-6 shrink-0" />
                  <span>{copy.continueWithGoogle}</span>
                </button>

                <form
                  className="grid gap-3"
                  onSubmit={authMode === "signin" ? handleSignIn : handleSignUp}
                  dir="ltr"
                >
                  {authMode === "signin" ? (
                    <div className="grid gap-2.5">
                      <input
                        type="text"
                        autoComplete="username"
                        value={signInIdentifier}
                        disabled={authBusy}
                        onChange={(event) => setSignInIdentifier(event.target.value)}
                        placeholder={copy.usernameOrEmail}
                        className={clsx(authInputClass, englishFontClass)}
                      />
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={signInPassword}
                        disabled={authBusy}
                        onChange={(event) => setSignInPassword(event.target.value)}
                        placeholder={copy.password}
                        className={clsx(authInputClass, englishFontClass)}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      <input
                        type="text"
                        autoComplete="username"
                        value={signUpUsername}
                        disabled={authBusy}
                        onChange={(event) => setSignUpUsername(event.target.value)}
                        placeholder={copy.username}
                        className={clsx(authInputClass, englishFontClass)}
                      />
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={signUpPassword}
                        disabled={authBusy}
                        onChange={(event) => setSignUpPassword(event.target.value)}
                        placeholder={copy.password}
                        className={clsx(authInputClass, englishFontClass)}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authBusy}
                    className={clsx(primaryButtonClass, "mt-1 w-full", englishFontClass)}
                  >
                    {authMode === "signin" ? copy.signInAction : copy.signUpAction}
                  </button>
                </form>

                {authError ? (
                  <p className={clsx("text-center text-[0.85rem] text-red-700", englishFontClass)}>
                    {authError}
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div dir="ltr" className="min-h-dvh bg-[#f7f6f3] text-[#121212]">
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col justify-center px-3 py-4 sm:px-4">
        <header className="mb-4 text-center sm:mb-5">
          <div
            className={clsx(
              "mb-4 flex items-center gap-2",
              isSignedIn ? "justify-between" : "justify-center"
            )}
          >
            <div className="inline-flex rounded-full bg-[#ebe7dc] p-1">
              <button
                type="button"
                onClick={() => setLanguage("ar")}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  englishFontClass,
                  isArabic ? "bg-white text-[#121212] shadow-sm" : "text-stone-600"
                )}
              >
                Arabic
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  englishFontClass,
                  !isArabic ? "bg-white text-[#121212] shadow-sm" : "text-stone-600"
                )}
              >
                English
              </button>
            </div>
            {isSignedIn ? (
              <div className="flex items-center gap-2">
                <span className={clsx("text-[1.02rem] font-normal text-stone-800", englishFontClass)}>
                  {`${copy.signedInAs} `}
                  <span className="font-bold">{userLabel}</span>
                </span>
                <button
                  type="button"
                  aria-label={copy.account}
                  onClick={() => setIsAccountPanelOpen(true)}
                  className="text-stone-700 transition hover:text-[#121212]"
                >
                  <Cog6ToothIcon aria-hidden className="h-7 w-7" />
                </button>
              </div>
            ) : null}
          </div>
          <h1
            className={clsx(
              "text-[clamp(1.65rem,4vw,2.15rem)] tracking-tight font-semibold",
              englishFontClass
            )}
          >
            {copy.title}
          </h1>
          <p
            className={clsx(
              "mt-2 text-[clamp(1rem,2.2vw,1.18rem)] font-normal text-stone-700",
              englishFontClass
            )}
          >
            {authStatus === "disabled"
              ? copy.authDisabled
              : status === "loading"
                ? copy.loadingHeading
                : isDailyProgressLoading
                  ? copy.progressLoading
                : status === "error"
                  ? copy.errorHeading
                  : hasFinished
                    ? isWon
                      ? copy.winMessage
                      : copy.loseMessage
                    : copy.introMessage}
          </p>
        </header>

        {authStatus === "disabled" ? (
          <div className="rounded-[1rem] bg-[#efede6] px-4 py-8 text-center text-stone-700">
            {copy.authDisabled}
          </div>
        ) : status === "loading" ? (
          <div className="rounded-[1rem] bg-[#efede6] px-4 py-8 text-center text-stone-600">
            {copy.loadingCard}
          </div>
        ) : isDailyProgressLoading ? (
          <div className="rounded-[1rem] bg-[#efede6] px-4 py-8 text-center text-stone-600">
            {copy.progressLoading}
          </div>
        ) : status === "error" ? (
          <div className="rounded-[1rem] bg-[#efede6] px-4 py-8 text-center text-stone-700">
            {copy.errorCard}
          </div>
        ) : (
          <>
            <div className="space-y-2.5 sm:space-y-3">
              {visibleSolvedGroups.map((group) => (
                <motion.div
                  key={group.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1rem] px-3 py-4 text-center sm:px-4 sm:py-5"
                  style={{ backgroundColor: group.solvedColor }}
                >
                  <div
                    className={clsx(
                      "whitespace-nowrap leading-tight",
                      getGroupTitleSizeClass(group, language),
                      puzzleWordFontClass,
                      isArabic ? "font-black" : "font-semibold"
                    )}
                  >
                    {getGroupTitle(group, language)}
                  </div>
                  <div
                    dir={isArabic ? "rtl" : "ltr"}
                    className={clsx(
                      "mt-2 text-[1.08rem] leading-snug text-stone-900 sm:text-[1.16rem]",
                      puzzleWordFontClass,
                      isArabic ? "font-medium" : "font-normal"
                    )}
                  >
                    {getGroupWordsText(group, language)}
                  </div>
                </motion.div>
              ))}
            </div>

            {!hasFinished ? (
              <>
                <motion.div
                  key={shakeKey}
                  animate={shakeKey === 0 ? { x: 0 } : { x: [0, -6, 6, -4, 4, 0] }}
                  transition={{ duration: 0.28 }}
                  dir="ltr"
                  className="mt-3 grid grid-cols-4 gap-2 sm:mt-4 sm:gap-2.5"
                >
                  {unsolvedTiles.map((tile) => {
                    const isSelected = selected.includes(tile.id);
                    const { primary, primaryDir, secondary, secondaryDir } =
                      getWordLines(tile.word, language);

                    return (
                      <motion.button
                        key={tile.id}
                        type="button"
                        layout
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.015 }}
                        aria-pressed={isSelected}
                        onClick={() => toggleWord(tile.id)}
                        className={clsx(
                          "flex aspect-square select-none items-center justify-center rounded-[0.8rem] border border-transparent px-1 text-center text-[#121212] transition-colors sm:px-2",
                          isSelected
                            ? "bg-[#5a594e] text-white"
                            : "bg-[#efede6] hover:bg-[#e7e2d7]"
                        )}
                      >
                        <span className="flex flex-col items-center gap-1 leading-none">
                          <span
                            dir={primaryDir}
                            className={clsx(
                              "leading-tight",
                              getTilePrimaryClass(language),
                              puzzleWordFontClass,
                              isArabic ? "font-medium" : "font-normal"
                            )}
                          >
                            {primary}
                          </span>
                          {secondary ? (
                            <span
                              dir={secondaryDir}
                              className={clsx(
                                "text-[0.66rem] tracking-[0.05em] sm:text-[0.74rem]",
                                puzzleWordFontClass,
                                isArabic ? "font-medium" : "font-medium",
                                isSelected ? "text-white/85" : "text-stone-500"
                              )}
                            >
                              {secondary}
                            </span>
                          ) : null}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>

                <div className="mt-5 flex items-center justify-center gap-3 text-[0.95rem] sm:text-[1.03rem]">
                  <span
                    className={clsx(
                      "font-normal text-stone-700",
                      englishFontClass
                    )}
                  >
                    {copy.mistakesRemaining}
                  </span>
                  <div className="flex gap-2" dir="ltr">
                    {Array.from({ length: MAX_MISTAKES }, (_, index) => (
                      <span
                        key={index}
                        className={clsx(
                          "h-3.5 w-3.5 rounded-full transition-colors",
                          index < remainingMistakes ? "bg-stone-500" : "bg-stone-200"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={shuffleBoard}
                    className={clsx(secondaryButtonClass, englishFontClass)}
                  >
                    {copy.shuffle}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className={clsx(secondaryButtonClass, englishFontClass)}
                  >
                    {copy.clearSelection}
                  </button>
                  <button
                    type="button"
                    onClick={submitGuess}
                    disabled={selected.length !== 4}
                    className={clsx(primaryButtonClass, englishFontClass)}
                  >
                    {copy.submit}
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}
      </main>

      {isSignedIn && hasFinished && isResultsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center">
          <section
            dir="ltr"
            className="w-full max-w-[31rem] rounded-[1rem] bg-[#f2f1ee] p-5 text-center sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className={clsx("text-[clamp(1.8rem,4vw,2.7rem)] font-black text-[#121212]", englishFontClass)}>
              {resultTitle}
            </h2>
            <p className={clsx("mt-1 text-[1rem] text-stone-700", englishFontClass)}>{copy.title}</p>

            <div className="mt-4 border-t border-b border-stone-400 py-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className={clsx("text-[1.85rem] leading-none text-[#121212]", englishFontClass)}>
                    {userStats.gamesPlayed}
                  </div>
                  <div className={clsx("mt-1 text-[0.93rem] text-stone-700", englishFontClass)}>
                    {copy.completedGames}
                  </div>
                </div>
                <div className="text-center">
                  <div className={clsx("text-[1.85rem] leading-none text-[#121212]", englishFontClass)}>
                    {winRate}
                  </div>
                  <div className={clsx("mt-1 text-[0.93rem] text-stone-700", englishFontClass)}>
                    {copy.winRate}
                  </div>
                </div>
                <div className="text-center">
                  <div className={clsx("text-[1.85rem] leading-none text-[#121212]", englishFontClass)}>
                    {userStats.currentStreak}
                  </div>
                  <div className={clsx("mt-1 text-[0.93rem] text-stone-700", englishFontClass)}>
                    {copy.currentStreak}
                  </div>
                </div>
                <div className="text-center">
                  <div className={clsx("text-[1.85rem] leading-none text-[#121212]", englishFontClass)}>
                    {userStats.bestStreak}
                  </div>
                  <div className={clsx("mt-1 text-[0.93rem] text-stone-700", englishFontClass)}>
                    {copy.maxStreak}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1.5">
              {guessHistory.map((guess, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-4 gap-1">
                  {guess.map((groupId, columnIndex) => (
                    <span
                      key={`${rowIndex}-${columnIndex}`}
                      className="h-8 w-8 rounded-[0.25rem] sm:h-9 sm:w-9"
                      style={{ backgroundColor: colorByGroupId.get(groupId) ?? "#d6d3d1" }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {shareMessage ? (
              <p className={clsx("mt-4 text-[0.82rem] text-stone-700", englishFontClass)}>{shareMessage}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleShareResults}
                disabled={shareBusy}
                className={clsx(primaryButtonClass, "min-w-40", englishFontClass)}
              >
                {shareBusy ? `${copy.shareResults}...` : copy.shareResults}
              </button>
              <button
                type="button"
                onClick={() => setIsResultsOpen(false)}
                className={clsx(secondaryButtonClass, "min-w-40", englishFontClass)}
              >
                {copy.closeResults}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isSignedIn && isAccountPanelOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-3 sm:items-center"
          onClick={() => setIsAccountPanelOpen(false)}
        >
          <section
            dir="ltr"
            className="w-full max-w-[30rem] rounded-[1rem] bg-[#f7f6f3] p-4 sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className={clsx("text-[1.1rem] font-semibold text-[#121212]", englishFontClass)}>
                {copy.accountTitle}
              </h2>
              <button
                type="button"
                onClick={() => setIsAccountPanelOpen(false)}
                className={clsx(
                  "h-9 rounded-full border border-stone-400 px-3 text-[0.86rem] text-stone-700 transition hover:bg-stone-100",
                  englishFontClass
                )}
              >
                {copy.close}
              </button>
            </div>

            <p className={clsx("mt-2 text-[0.92rem] text-stone-700", englishFontClass)}>
              {copy.signedInAs} <span className="font-semibold text-[#121212]">{userLabel}</span>
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white px-3 py-2 text-center">
                <div className={clsx("text-[0.7rem] text-stone-500", englishFontClass)}>
                  {copy.completedGames}
                </div>
                <div className={clsx("text-[1.1rem] font-semibold", englishFontClass)}>
                  {userStats.gamesPlayed}
                </div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-center">
                <div className={clsx("text-[0.7rem] text-stone-500", englishFontClass)}>{copy.winRate}</div>
                <div className={clsx("text-[1.1rem] font-semibold", englishFontClass)}>
                  {winRate}
                </div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-center">
                <div className={clsx("text-[0.7rem] text-stone-500", englishFontClass)}>
                  {copy.currentStreak}
                </div>
                <div className={clsx("text-[1.1rem] font-semibold", englishFontClass)}>
                  {userStats.currentStreak}
                </div>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-center">
                <div className={clsx("text-[0.7rem] text-stone-500", englishFontClass)}>{copy.maxStreak}</div>
                <div className={clsx("text-[1.1rem] font-semibold", englishFontClass)}>
                  {userStats.bestStreak}
                </div>
              </div>
            </div>

            {statsBusy ? (
              <p className={clsx("mt-3 text-[0.82rem] text-stone-500", englishFontClass)}>
                {copy.statsSyncing}
              </p>
            ) : null}

            {statsError ? (
              <p className={clsx("mt-3 text-[0.82rem] text-red-700", englishFontClass)}>
                {copy.statsSyncError}
              </p>
            ) : null}

            {authError ? (
              <p className={clsx("mt-3 text-[0.82rem] text-red-700", englishFontClass)}>{authError}</p>
            ) : null}

            <button
              type="button"
              onClick={handleSignOut}
              disabled={authBusy}
              className={clsx(secondaryButtonClass, "mt-4 w-full", englishFontClass)}
            >
              {copy.signOut}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
