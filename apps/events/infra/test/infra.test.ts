import assert from "node:assert/strict";
import { before, test } from "node:test";
import * as pulumi from "@pulumi/pulumi";

type Res = { type: string; name: string; inputs: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const resources: Res[] = [];
const of = (type: string) => resources.filter((r) => r.type === type);

before(async () => {
  await pulumi.runtime.setMocks({
    newResource: (a) => {
      resources.push({ type: a.type, name: a.name, inputs: a.inputs });
      return { id: `${a.name}-id`, state: { ...a.inputs, arn: `arn:aws:mock:::${a.name}`, url: `https://sqs.mock/${a.name}`, bucket: a.name, name: a.inputs.name ?? a.name } };
    },
    call: (a) => a.inputs,
  }, "codeks-labs-events", "test", false);
  const mod = await import("../index");
  await new Promise<void>((resolve) => pulumi.all([mod.eventBusName, mod.trailTable]).apply(() => resolve()));
  // Resources whose inputs depend on other outputs register asynchronously: wait until the count settles.
  let last = -1, stable = 0;
  while (stable < 8) {
    await new Promise((r) => setTimeout(r, 50));
    stable = resources.length === last ? stable + 1 : 0;
    last = resources.length;
  }
});

test("three stages, each with a queue, a DLQ, a Lambda and a mapping", () => {
  assert.equal(of("aws:sqs/queue:Queue").length, 6);
  assert.equal(of("aws:lambda/function:Function").length, 3);
  assert.equal(of("aws:lambda/eventSourceMapping:EventSourceMapping").length, 3);
});

test("every main queue redrives to its DLQ after 3 receives", () => {
  const main = of("aws:sqs/queue:Queue").filter((q) => q.name.endsWith("-queue"));
  assert.equal(main.length, 3);
  for (const q of main) {
    const p = JSON.parse(q.inputs.redrivePolicy);
    assert.equal(p.maxReceiveCount, 3);
    assert.match(p.deadLetterTargetArn, /-dlq/);
  }
});

test("queue visibility timeout covers the Lambda timeout", () => {
  const timeout = Math.max(...of("aws:lambda/function:Function").map((f) => f.inputs.timeout));
  for (const q of of("aws:sqs/queue:Queue").filter((q) => q.name.endsWith("-queue")))
    assert.ok(q.inputs.visibilityTimeoutSeconds >= timeout);
});

test("rule matches only reservation.created from labs.events", () => {
  const [rule] = of("aws:cloudwatch/eventRule:EventRule");
  assert.deepEqual(JSON.parse(rule.inputs.eventPattern), { source: ["labs.events"], "detail-type": ["reservation.created"] });
  assert.equal(of("aws:cloudwatch/eventTarget:EventTarget").length, 3);
});

test("workers report partial batch failures and have capped concurrency", () => {
  for (const m of of("aws:lambda/eventSourceMapping:EventSourceMapping")) {
    assert.deepEqual(m.inputs.functionResponseTypes, ["ReportBatchItemFailures"]);
    assert.ok(m.inputs.scalingConfig.maximumConcurrency <= 2);
  }
});

test("statements bucket blocks all public access and expires objects", () => {
  const [b] = of("aws:s3/bucketPublicAccessBlock:BucketPublicAccessBlock");
  for (const k of ["blockPublicAcls", "blockPublicPolicy", "ignorePublicAcls", "restrictPublicBuckets"]) assert.equal(b.inputs[k], true);
  assert.equal(of("aws:s3/bucketLifecycleConfiguration:BucketLifecycleConfiguration").length, 1);
});

test("no IAM policy grants wildcard actions; front user can only PutEvents and Query", () => {
  for (const p of of("aws:iam/rolePolicy:RolePolicy").concat(of("aws:iam/userPolicy:UserPolicy"))) {
    for (const s of JSON.parse(p.inputs.policy).Statement) {
      for (const a of [].concat(s.Action)) assert.ok(!String(a).includes("*"), `${p.name}: ${a}`);
    }
  }
  const front = JSON.parse(of("aws:iam/userPolicy:UserPolicy")[0].inputs.policy).Statement.flatMap((s: any) => s.Action); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.deepEqual(front.sort(), ["dynamodb:Query", "events:PutEvents"]);
});

test("only the statement role may write to S3", () => {
  const withS3 = of("aws:iam/rolePolicy:RolePolicy").filter((p) => p.inputs.policy.includes("s3:PutObject"));
  assert.deepEqual(withS3.map((p) => p.name), ["statement-policy"]);
});

test("trail table expires rows with TTL", () => {
  assert.equal(of("aws:dynamodb/table:Table")[0].inputs.ttl.enabled, true);
});
