export type PuzzleWord = {
  arabic: string;
  arabeezy?: string;
};

export type LocalizedText = {
  ar: string;
  en?: string;
};

export type Group = {
  id: string;
  title: LocalizedText;
  solvedColor: string;
  words: PuzzleWord[];
};

const STATIC_PUZZLE_URL = "/puzzle.json";
const DEFAULT_API_URL = "/api/puzzle";
const API_URL = import.meta.env.VITE_PUZZLE_API_URL || DEFAULT_API_URL;

function isPuzzleWord(value: unknown): value is PuzzleWord {
  if (typeof value === "string") return true;
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.arabic === "string" &&
    (candidate.arabeezy === undefined || typeof candidate.arabeezy === "string")
  );
}

function normalizeWord(value: string | PuzzleWord): PuzzleWord {
  if (typeof value === "string") {
    return { arabic: value };
  }

  return value;
}

function isLocalizedText(value: unknown): value is LocalizedText {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.ar === "string" &&
    (candidate.en === undefined || typeof candidate.en === "string")
  );
}

function normalizeTitle(value: string | LocalizedText): LocalizedText {
  if (typeof value === "string") {
    return { ar: value };
  }

  return value;
}

function isGroupShape(value: unknown): value is Omit<Group, "title" | "words"> & {
  title: string | LocalizedText;
  words: Array<string | PuzzleWord>;
} {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    (typeof candidate.title === "string" || isLocalizedText(candidate.title)) &&
    typeof candidate.solvedColor === "string" &&
    Array.isArray(candidate.words) &&
    candidate.words.length === 4 &&
    candidate.words.every(isPuzzleWord)
  );
}

function validateGroups(value: unknown): Group[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isGroupShape)) {
    throw new Error("Invalid puzzle payload.");
  }

  return value.map((group) => ({
    ...group,
    title: normalizeTitle(group.title),
    words: group.words.map(normalizeWord),
  }));
}

async function fetchJson(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export async function loadGroups() {
  try {
    const apiPayload = await fetchJson(API_URL);
    return validateGroups(apiPayload);
  } catch (apiError) {
    if (API_URL !== STATIC_PUZZLE_URL) {
      const staticPayload = await fetchJson(STATIC_PUZZLE_URL);
      return validateGroups(staticPayload);
    }

    throw apiError;
  }
}

export function createTiles(groups: Group[]) {
  return groups.flatMap((group) =>
    group.words.map((word) => ({
      word,
      groupId: group.id,
    }))
  );
}
