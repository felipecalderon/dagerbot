export type CucumberEater = {
  name: string;
  caughtAt: number;
};

// Backticks would close the inline-code span in the panel.
export function sanitizeCucumberEaterName(name: string): string {
  return name.replace(/`/g, "'").trim() || "unknown";
}

export function formatMostRecentCucumberEater(eater: CucumberEater | null): string {
  if (!eater) return "Nadie recibio hasta ahora.";
  const seconds = Math.floor(eater.caughtAt / 1000);
  return `\`${sanitizeCucumberEaterName(eater.name)}\` <t:${seconds}:R>`;
}
