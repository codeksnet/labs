import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as path from "node:path";
import { DETAIL_TYPE, MAX_RECEIVES, SOURCE, STAGES } from "../lib/contract";

const cfg = new pulumi.Config();
const alertEmail = cfg.get("alertEmail");
const LAMBDA_TIMEOUT = 10;
const VISIBILITY_TIMEOUT = 60; // must be >= the Lambda timeout; leaves room for retries

const bus = new aws.cloudwatch.EventBus("labs-events");

// Trail of what each worker did; rows expire after 24h (TTL) so the demo stays inside the free tier.
const trail = new aws.dynamodb.Table("trail", {
  billingMode: "PAY_PER_REQUEST",
  hashKey: "pk",
  rangeKey: "sk",
  attributes: [{ name: "pk", type: "S" }, { name: "sk", type: "S" }],
  ttl: { attributeName: "ttl", enabled: true },
});

const statements = new aws.s3.Bucket("statements", { forceDestroy: true });
new aws.s3.BucketPublicAccessBlock("statements-private", {
  bucket: statements.id,
  blockPublicAcls: true, blockPublicPolicy: true, ignorePublicAcls: true, restrictPublicBuckets: true,
});
new aws.s3.BucketLifecycleConfiguration("statements-expiry", {
  bucket: statements.id,
  rules: [{ id: "expire", status: "Enabled", filter: {}, expiration: { days: 7 } }],
});

const rule = new aws.cloudwatch.EventRule("reservation-created", {
  eventBusName: bus.name,
  eventPattern: JSON.stringify({ source: [SOURCE], "detail-type": [DETAIL_TYPE] }),
});

const assumeLambda = aws.iam.getPolicyDocumentOutput({
  statements: [{ actions: ["sts:AssumeRole"], principals: [{ type: "Service", identifiers: ["lambda.amazonaws.com"] }] }],
});

const queueUrls: Record<string, pulumi.Output<string>> = {};
const dlqUrls: Record<string, pulumi.Output<string>> = {};

for (const stage of STAGES) {
  // Each stage: queue + DLQ, a worker Lambda, and a rule target. A failure in one stage never blocks the others.
  const dlq = new aws.sqs.Queue(`${stage}-dlq`, { messageRetentionSeconds: 14 * 86400 });
  const queue = new aws.sqs.Queue(`${stage}-queue`, {
    visibilityTimeoutSeconds: VISIBILITY_TIMEOUT,
    redrivePolicy: dlq.arn.apply((arn) => JSON.stringify({ deadLetterTargetArn: arn, maxReceiveCount: MAX_RECEIVES })),
  });
  queueUrls[stage] = queue.url;
  dlqUrls[stage] = dlq.url;

  new aws.sqs.QueuePolicy(`${stage}-from-eventbridge`, {
    queueUrl: queue.url,
    policy: pulumi.all([queue.arn, rule.arn]).apply(([queueArn, ruleArn]) => JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow", Principal: { Service: "events.amazonaws.com" }, Action: "sqs:SendMessage",
        Resource: queueArn, Condition: { ArnEquals: { "aws:SourceArn": ruleArn } },
      }],
    })),
  });
  new aws.cloudwatch.EventTarget(`${stage}-target`, { rule: rule.name, eventBusName: bus.name, arn: queue.arn });

  const role = new aws.iam.Role(`${stage}-role`, { assumeRolePolicy: assumeLambda.json });
  new aws.iam.RolePolicy(`${stage}-policy`, {
    role: role.id,
    policy: pulumi.all([queue.arn, trail.arn, statements.arn]).apply(([queueArn, trailArn, bucketArn]) => JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Action: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"], Resource: queueArn },
        { Effect: "Allow", Action: ["dynamodb:PutItem"], Resource: trailArn },
        { Effect: "Allow", Action: ["logs:CreateLogStream", "logs:PutLogEvents"], Resource: "*" },
        ...(stage === "statement" ? [{ Effect: "Allow", Action: ["s3:PutObject"], Resource: `${bucketArn}/statements/*` }] : []),
      ],
    })),
  });

  const logs = new aws.cloudwatch.LogGroup(`${stage}-logs`, { name: `/aws/lambda/labs-events-${stage}`, retentionInDays: 7 });
  const fn = new aws.lambda.Function(`${stage}-worker`, {
    name: `labs-events-${stage}`,
    runtime: "nodejs22.x",
    handler: "index.handler",
    role: role.arn,
    timeout: LAMBDA_TIMEOUT,
    memorySize: 128,
    // Build first: `pnpm build` bundles handlers/ into dist/index.js.
    code: new pulumi.asset.AssetArchive({ "index.js": new pulumi.asset.FileAsset(path.join(__dirname, "dist", "index.js")) }),
    environment: { variables: { STAGE: stage, TRAIL_TABLE: trail.name, STATEMENTS_BUCKET: statements.bucket } },
  }, { dependsOn: [logs] });

  new aws.lambda.EventSourceMapping(`${stage}-mapping`, {
    eventSourceArn: queue.arn,
    functionName: fn.arn,
    batchSize: 5,
    functionResponseTypes: ["ReportBatchItemFailures"],
    scalingConfig: { maximumConcurrency: 2 }, // caps cost and blast radius
  });
}

// Least-privilege identity for the Next.js front (runs on Coolify): emit events, read the trail. Nothing else.
const front = new aws.iam.User("front");
new aws.iam.UserPolicy("front-policy", {
  user: front.name,
  policy: pulumi.all([bus.arn, trail.arn]).apply(([busArn, trailArn]) => JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", Action: ["events:PutEvents"], Resource: busArn },
      { Effect: "Allow", Action: ["dynamodb:Query"], Resource: trailArn },
    ],
  })),
});
const frontKey = new aws.iam.AccessKey("front-key", { user: front.name });

if (alertEmail) {
  new aws.budgets.Budget("monthly-10-usd", {
    budgetType: "COST", limitAmount: "10", limitUnit: "USD", timeUnit: "MONTHLY",
    notifications: [{
      comparisonOperator: "GREATER_THAN", threshold: 80, thresholdType: "PERCENTAGE",
      notificationType: "ACTUAL", subscriberEmailAddresses: [alertEmail],
    }],
  });
}

export const eventBusName = bus.name;
export const trailTable = trail.name;
export const statementsBucket = statements.bucket;
export const frontAccessKeyId = frontKey.id;
export const frontSecretAccessKey = pulumi.secret(frontKey.secret);
export const queues = queueUrls;
export const deadLetterQueues = dlqUrls;
