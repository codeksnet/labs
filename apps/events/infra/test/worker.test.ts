import assert from "node:assert/strict";
import { test } from "node:test";
import type { SQSEvent } from "aws-lambda";
import type { TrailItem } from "../../lib/contract";
import { makeHandler, type Deps } from "../handlers/worker";

function setup() {
  const trail: TrailItem[] = [];
  const statements: Record<string, string> = {};
  const deps: Deps = {
    now: () => new Date("2026-11-30T10:00:00Z"),
    putTrail: async (i) => void trail.push(i),
    putStatement: async (k, b) => void (statements[k] = b),
  };
  return { trail, statements, deps };
}

const msg = (over: object = {}, attempt = 1): SQSEvent => ({
  Records: [{
    messageId: "m1",
    attributes: { ApproximateReceiveCount: String(attempt) },
    body: JSON.stringify({
      id: "e1", source: "labs.events", "detail-type": "reservation.created", time: "t",
      detail: { reservationId: "r1", guest: "Ada", nights: 3, simulateFailure: false, ...over },
    }),
  }],
} as unknown as SQSEvent);

test("statement stage writes the statement and a trail row", async () => {
  const { trail, statements, deps } = setup();
  const res = await makeHandler("statement", deps)(msg());
  assert.deepEqual(res.batchItemFailures, []);
  assert.equal(JSON.parse(statements["statements/r1.json"]).net, 316.8); // 360 gross - 12% fee
  assert.equal(trail[0].status, "ok");
});

test("cleaning and confirmation never touch S3", async () => {
  const { statements, trail, deps } = setup();
  for (const stage of ["cleaning", "confirmation"] as const) await makeHandler(stage, deps)(msg());
  assert.deepEqual(statements, {});
  assert.equal(trail.length, 2);
});

test("simulated failure is reported per record so only it retries", async () => {
  const { trail, statements, deps } = setup();
  const res = await makeHandler("statement", deps)(msg({ simulateFailure: true }));
  assert.deepEqual(res.batchItemFailures, [{ itemIdentifier: "m1" }]);
  assert.equal(trail[0].status, "failed");
  assert.match(trail[0].message, /will retry/);
  assert.deepEqual(statements, {});
});

test("failure on the last receive says it moves to the DLQ", async () => {
  const { trail, deps } = setup();
  await makeHandler("statement", deps)(msg({ simulateFailure: true }, 3));
  assert.match(trail[0].message, /moved to DLQ/);
});

test("simulateFailure only breaks the statement stage", async () => {
  const { deps } = setup();
  const res = await makeHandler("cleaning", deps)(msg({ simulateFailure: true }));
  assert.deepEqual(res.batchItemFailures, []);
});

test("redelivery overwrites the same trail key (idempotent)", async () => {
  const { trail, deps } = setup();
  const h = makeHandler("confirmation", deps);
  await h(msg());
  await h(msg());
  assert.equal(new Set(trail.map((t) => t.pk + t.sk)).size, 1);
});
