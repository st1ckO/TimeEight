export const DISPLAY_NAME_MAX_LENGTH = 40;

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
}
