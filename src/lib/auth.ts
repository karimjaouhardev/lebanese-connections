const USERNAME_DOMAIN = "family.local";
const USERNAME_PATTERN = /^[a-z0-9._-]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(input: string) {
  const normalized = input.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error("invalid_username");
  }

  return normalized;
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

export function identifierToEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();

  if (!value) {
    throw new Error("invalid_identifier");
  }

  if (value.includes("@")) {
    if (!EMAIL_PATTERN.test(value)) {
      throw new Error("invalid_identifier");
    }

    return value;
  }

  return usernameToEmail(value);
}

export function usernameFromEmail(email: string | null | undefined) {
  if (!email) return null;

  if (email.endsWith(`@${USERNAME_DOMAIN}`)) {
    return email.slice(0, email.indexOf("@"));
  }

  return email;
}
