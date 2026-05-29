/**
 * Alerter — turns a classification into an Action log entry + alert snapshot.
 * Uses the LLM where possible, deterministic template otherwise.
 */

import type { Address } from "viem";
import type { HealthClassification, LatestAlert } from "../types.js";
import type { TesseraLLM } from "../llm/client.js";
import { generateAlertCopy } from "../llm/alert-copy.js";
import type { JsonlLog } from "../log/jsonl.js";
import type { AlertSnapshot } from "../log/alerts.js";
import { action } from "../log/action.js";

export interface AlerterDeps {
  llm: TesseraLLM;
  log: JsonlLog;
  alerts: AlertSnapshot;
}

/**
 * Emit an alert for `user` at the given classification. Idempotent w.r.t.
 * the alert snapshot (will update existing entry rather than duplicate).
 */
export async function emitAlert(
  deps: AlerterDeps,
  user: Address,
  c: HealthClassification,
  context?: string,
): Promise<LatestAlert> {
  const copy = await generateAlertCopy(deps.llm, {
    user,
    hf: c.hf,
    level: c.level,
    score: c.score,
    ...(context !== undefined ? { context } : {}),
  });
  const alert: LatestAlert = {
    user,
    hf: c.hf.toString(),
    level: c.level,
    score: c.score,
    copy,
    updatedAt: new Date().toISOString(),
  };
  deps.alerts.upsert(alert);
  deps.log.append(action.alert(user, c.hf, c.level, copy));
  return alert;
}
