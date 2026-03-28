export type InspirationTokenGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string }
