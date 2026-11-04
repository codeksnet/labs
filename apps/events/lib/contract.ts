// The event contract. Imported by the Lambda workers (bundled by esbuild) and by the Next.js front.
export const SOURCE = "labs.events";
export const DETAIL_TYPE = "reservation.created";
export const STAGES = ["cleaning", "confirmation", "statement"] as const;
export type Stage = (typeof STAGES)[number];
/** SQS maxReceiveCount: after this many failed attempts a message moves to the stage's DLQ. */
export const MAX_RECEIVES = 3;

export interface ReservationCreated {
  reservationId: string;
  guest: string;
  nights: number;
  /** Demo switch: makes the `statement` stage throw so you can watch retries and the DLQ. */
  simulateFailure: boolean;
}

/** EventBridge envelope as delivered to SQS (only the fields we use). */
export interface EventEnvelope<T> {
  id: string;
  source: string;
  "detail-type": string;
  time: string;
  detail: T;
}

export interface TrailItem {
  pk: string; // reservationId
  sk: string; // `${stage}#${attempt}` so an SQS redelivery overwrites itself (idempotent)
  stage: Stage;
  status: "ok" | "failed";
  attempt: number;
  ts: string;
  message: string;
  ttl: number; // epoch seconds; DynamoDB expires the row
}
