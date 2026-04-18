import clsx from "clsx";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { createTiles, loadGroups, type Group, type PuzzleWord } from "./lib/puzzle";

type Language = "ar" | "en";

type Tile = {
  word: PuzzleWord;
  groupId: string;
};

const MAX_MISTAKES = 4;

const actionButtonClass =
  "h-12 rounded-full border border-[#121212] bg-white px-5 text-[0.98rem] font-semibold text-[#121212] transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-white disabled:text-stone-400";

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
  }
> = {
  ar: {
    title: "وصلات",
    loadingHeading: "عم نحضّر لعبة اليوم...",
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
  },
  en: {
    title: "Connections",
    loadingHeading: "Getting today's game ready...",
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
      secondary: word.arabeezy ? word.arabic : undefined,
      primaryDir: word.arabeezy ? "ltr" : "rtl",
      secondaryDir: "rtl" as const,
    };
  }

  return {
    primary: word.arabic,
    secondary: word.arabeezy,
    primaryDir: "rtl" as const,
    secondaryDir: "ltr" as const,
  };
}

function getGroupTitle(group: Group, language: Language) {
  if (language === "en") {
    return group.title.en ?? group.title.ar;
  }

  return group.title.ar;
}

export default function App() {
  const [language, setLanguage] = useState<Language>("ar");
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selected, setSelected] = useState<string[]>([]);
  const [solvedGroupIds, setSolvedGroupIds] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const copy = COPY[language];
  const isArabic = language === "ar";

  useEffect(() => {
    let isActive = true;

    const initializeGame = async () => {
      try {
        const nextGroups = await loadGroups();
        if (!isActive) return;

        setGroups(nextGroups);
        setTiles(shuffle(createTiles(nextGroups)));
        setSelected([]);
        setSolvedGroupIds([]);
        setMistakes(0);
        setShakeKey(0);
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
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
  }, [isArabic, language]);

  const solvedGroups = groups.filter((group) => solvedGroupIds.includes(group.id));
  const isWon = groups.length > 0 && solvedGroupIds.length === groups.length;
  const isLost = mistakes >= MAX_MISTAKES && !isWon;
  const hasFinished = isWon || isLost;
  const visibleSolvedGroups = isLost ? groups : solvedGroups;
  const unsolvedTiles = hasFinished
    ? []
    : tiles.filter((tile) => !solvedGroupIds.includes(tile.groupId));
  const remainingMistakes = Math.max(MAX_MISTAKES - mistakes, 0);

  const toggleWord = (word: string) => {
    if (hasFinished) return;

    if (selected.includes(word)) {
      setSelected((prev) => prev.filter((item) => item !== word));
      return;
    }

    if (selected.length >= 4) return;
    setSelected((prev) => [...prev, word]);
  };

  const submitGuess = () => {
    if (selected.length !== 4 || hasFinished) return;

    const selectedTiles = tiles.filter((tile) => selected.includes(tile.word.arabic));
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

  const resetGame = () => {
    if (groups.length === 0) return;

    setSelected([]);
    setSolvedGroupIds([]);
    setMistakes(0);
    setShakeKey(0);
    setTiles(shuffle(createTiles(groups)));
  };

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="min-h-dvh bg-[#f7f6f3] text-[#121212]">
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col justify-center px-3 py-4 sm:px-4">
        <header className="mb-4 text-center sm:mb-5">
          <div className="mb-4 flex justify-center">
            <div className="inline-flex rounded-full bg-[#ebe7dc] p-1">
              <button
                type="button"
                onClick={() => setLanguage("ar")}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  isArabic ? "bg-white text-[#121212] shadow-sm" : "text-stone-600"
                )}
              >
                العربية
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  !isArabic ? "bg-white text-[#121212] shadow-sm" : "text-stone-600"
                )}
              >
                English
              </button>
            </div>
          </div>
          <h1 className="text-[clamp(1.65rem,4vw,2.15rem)] font-black tracking-tight">
            {copy.title}
          </h1>
          <p className="mt-2 text-[clamp(1rem,2.2vw,1.18rem)] font-medium text-stone-700">
            {status === "loading"
              ? copy.loadingHeading
              : status === "error"
                ? copy.errorHeading
                : hasFinished
              ? isWon
                ? copy.winMessage
                : copy.loseMessage
              : copy.introMessage}
          </p>
        </header>

        {status === "loading" ? (
          <div className="rounded-[1rem] bg-[#efede6] px-4 py-8 text-center text-stone-600">
            {copy.loadingCard}
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
                  <div className="text-[clamp(1.05rem,2.4vw,1.5rem)] font-black leading-tight">
                    {getGroupTitle(group, language)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                    {group.words.map((word) => {
                      const { primary, primaryDir, secondary, secondaryDir } =
                        getWordLines(word, language);

                      return (
                        <div key={word.arabic} className="text-center">
                          <div
                            dir={primaryDir}
                            className="text-[0.98rem] font-semibold leading-tight text-stone-900 sm:text-[1.08rem]"
                          >
                            {primary}
                          </div>
                          {secondary ? (
                            <div
                              dir={secondaryDir}
                              className="mt-1 text-[0.68rem] font-semibold tracking-[0.05em] text-stone-700 sm:text-[0.74rem]"
                            >
                              {secondary}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
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
                    const isSelected = selected.includes(tile.word.arabic);
                    const { primary, primaryDir, secondary, secondaryDir } =
                      getWordLines(tile.word, language);

                    return (
                      <motion.button
                        key={tile.word.arabic}
                        type="button"
                        layout
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.015 }}
                        aria-pressed={isSelected}
                        onClick={() => toggleWord(tile.word.arabic)}
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
                            className="text-[clamp(0.82rem,2vw,1.22rem)] font-black leading-tight"
                          >
                            {primary}
                          </span>
                          {secondary ? (
                            <span
                              dir={secondaryDir}
                              className={clsx(
                                "text-[0.54rem] font-semibold tracking-[0.05em] sm:text-[0.68rem]",
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
                  <span className="font-medium text-stone-700">{copy.mistakesRemaining}</span>
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
                    className={actionButtonClass}
                  >
                    {copy.shuffle}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className={actionButtonClass}
                  >
                    {copy.clearSelection}
                  </button>
                  <button
                    type="button"
                    onClick={submitGuess}
                    disabled={selected.length !== 4}
                    className={actionButtonClass}
                  >
                    {copy.submit}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={resetGame}
                  className={clsx(actionButtonClass, "min-w-40")}
                >
                  {copy.playAgain}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
