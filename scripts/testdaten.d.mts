export const KONTO_1: string;
export const KONTO_2: string;
export const ERLAUBTE_KONTEN: string[];
export function wasserEintraege(
  konto: string,
  userId: string,
  jetzt?: Date,
): { user_id: string; amount_ml: number; logged_at: string }[];
export function run(opts?: {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  jetzt?: Date;
  modus?: "seed" | "reset";
  log?: (s: string) => void;
}): Promise<Record<string, string[]>>;
