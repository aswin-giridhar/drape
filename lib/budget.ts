/**
 * Unit budget guard.
 *
 * The hackathon grant is finite and has to survive judging (18-31 Aug), so live
 * generation stops at a reserve floor rather than failing mid-demo.
 *
 * Two rules this must never break:
 *   1. "Paused" and "broken" must look different to the user.
 *   2. A pause must still show the best answer we have (a cached example),
 *      never a blank screen.
 */

import { OutOfUnitsError, remainingUnits } from "./youcam";

/** Measured costs. See the spec, section 2. */
export const COST = {
  skinAnalysis: 16,
  toneAnalysis: 20,
  tryOn: 2,
} as const;

export const FULL_SCAN_COST = COST.skinAnalysis + COST.toneAnalysis;

/**
 * Below this, live generation pauses. Chosen to leave roughly four full scans
 * plus a dozen try-ons in hand, so a judge arriving late still gets a live run.
 */
export const RESERVE_FLOOR = 150;

let cache: { units: number; at: number } | null = null;
const TTL_MS = 30_000;

export async function unitsRemaining(force = false): Promise<number> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.units;
  const units = await remainingUnits();
  cache = { units, at: Date.now() };
  return units;
}

/** Call before spending. Throws OutOfUnitsError if the spend would breach the floor. */
export async function assertBudget(cost: number): Promise<number> {
  const units = await unitsRemaining();
  if (units - cost < RESERVE_FLOOR) {
    throw new OutOfUnitsError(units);
  }
  return units;
}

/** Optimistically decrement so bursts of parallel requests can't overshoot. */
export function noteSpend(cost: number): void {
  if (cache) cache.units = Math.max(0, cache.units - cost);
}

export interface BudgetStatus {
  units: number;
  reserveFloor: number;
  liveGenerationAvailable: boolean;
  scansAffordable: number;
  tryOnsAffordable: number;
}

export async function budgetStatus(): Promise<BudgetStatus> {
  const units = await unitsRemaining();
  const spendable = Math.max(0, units - RESERVE_FLOOR);
  return {
    units,
    reserveFloor: RESERVE_FLOOR,
    liveGenerationAvailable: spendable >= FULL_SCAN_COST,
    scansAffordable: Math.floor(spendable / FULL_SCAN_COST),
    tryOnsAffordable: Math.floor(spendable / COST.tryOn),
  };
}
