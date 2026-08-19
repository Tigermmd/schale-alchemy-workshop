/** Return an external URL only when the data source uses an allowed scheme. */
export function safeExternalUrl(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? candidate : "";
  } catch {
    return "";
  }
}
