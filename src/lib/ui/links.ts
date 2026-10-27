// Venue links come from Qloo data, so they are checked before they become hrefs.

/** Only http(s) URLs; anything else (javascript:, data:, garbage) is dropped. */
export function safeHttpUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** "tel:" href with digits and a leading + only; null if too short to be a number. */
export function telHref(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}
