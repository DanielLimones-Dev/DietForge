export function normalizeNumericInput(value: string): string {
  // Preserve an empty edit and valid decimals, but remove zeros that appear
  // before another digit (050 -> 50, 00.5 -> 0.5).
  return value.replace(/^(-?)0+(?=\d)/, "$1");
}
