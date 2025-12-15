function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (!trimmed) continue;
    const [rawKey, ...rest] = trimmed.split("=");
    if (decodeURIComponent(rawKey) !== name) continue;
    return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function ensureUserIdCookie() {
  if (typeof document === "undefined") return null;
  const existing = readCookie("userId");
  if (existing) {
    return existing;
  }
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const expires = new Date(Date.now() + 31536000000).toUTCString();
  document.cookie = `userId=${encodeURIComponent(uuid)}; path=/; expires=${expires}; SameSite=Lax`;
  return uuid;
}

export function getUserIdFromCookie() {
  return ensureUserIdCookie();
}
