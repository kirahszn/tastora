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

/**
 * Display form of a Qloo phone number. Qloo sends E.164 ("+14165049669", "+442073994330"; Phase 9c
 * check). US/Canada (+1, 10 digits) → "(416) 504-9669". Anything else is shown as provided,
 * which for Qloo is the international form. The tel: link stays E.164 (telHref).
 */
export function formatPhone(phone: string | undefined | null): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  const nanp = /^\+?1?[\s.-]*\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})$/.exec(trimmed);
  const digits = trimmed.replace(/\D/g, "");
  const isNanp = nanp && (digits.length === 10 ? !trimmed.startsWith("+") : digits.length === 11 && digits[0] === "1");
  return isNanp ? `(${nanp[1]}) ${nanp[2]}-${nanp[3]}` : trimmed;
}
