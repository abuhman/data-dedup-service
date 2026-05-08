export function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '');
}
