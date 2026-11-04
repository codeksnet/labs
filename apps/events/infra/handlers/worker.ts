import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import {
  type EventEnvelope, MAX_RECEIVES, type ReservationCreated, type Stage, type TrailItem,
} from "../../lib/contract";

export interface Deps {
  putTrail(item: TrailItem): Promise<void>;
  putStatement(key: string, body: string): Promise<void>;
  now(): Date;
}

const TTL_SECONDS = 24 * 3600;
const NIGHTLY_RATE_EUR = 120;
const MGMT_FEE = 0.12;

/** Pure-ish business step per stage. Returns a human message for the trail. */
async function runStage(stage: Stage, d: ReservationCreated, deps: Deps): Promise<string> {
  switch (stage) {
    case "cleaning": {
      const out = new Date(deps.now().getTime() + d.nights * 86400_000);
      return `Cleaning scheduled for checkout on ${out.toISOString().slice(0, 10)}`;
    }
    case "confirmation":
      return `Confirmation sent to ${d.guest} (simulated, no email is sent)`;
    case "statement": {
      if (d.simulateFailure) throw new Error("simulated failure in statement generation");
      const gross = d.nights * NIGHTLY_RATE_EUR;
      const fee = Math.round(gross * MGMT_FEE * 100) / 100;
      const key = `statements/${d.reservationId}.json`; // same key on redelivery: idempotent
      await deps.putStatement(key, JSON.stringify({ ...d, gross, fee, net: gross - fee }, null, 2));
      return `Owner statement written to s3://…/${key} (gross ${gross}, net ${gross - fee})`;
    }
  }
}

export function makeHandler(stage: Stage, deps: Deps) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const failures: { itemIdentifier: string }[] = [];
    for (const rec of event.Records) {
      const env = JSON.parse(rec.body) as EventEnvelope<ReservationCreated>;
      const attempt = Number(rec.attributes.ApproximateReceiveCount ?? "1");
      const ts = deps.now();
      const base = {
        pk: env.detail.reservationId, sk: `${stage}#${attempt}`, stage, attempt,
        ts: ts.toISOString(), ttl: Math.floor(ts.getTime() / 1000) + TTL_SECONDS,
      };
      try {
        const message = await runStage(stage, env.detail, deps);
        await deps.putTrail({ ...base, status: "ok", message });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const dlq = attempt >= MAX_RECEIVES ? " → moved to DLQ" : " → will retry";
        await deps.putTrail({ ...base, status: "failed", message: `${msg} (attempt ${attempt}/${MAX_RECEIVES}${dlq})` });
        failures.push({ itemIdentifier: rec.messageId }); // partial batch response: only this record retries
      }
    }
    return { batchItemFailures: failures };
  };
}
