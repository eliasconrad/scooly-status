/** "8,4 s" bzw. "840 ms" - ab einer Sekunde in Sekunden, das liest sich besser. */
export function zeit(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}
