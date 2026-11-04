// Lambda entry. One bundle, three functions: the STAGE env var picks the behaviour.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Stage } from "../../lib/contract";
import { makeHandler } from "./worker";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

export const handler = makeHandler(process.env.STAGE as Stage, {
  now: () => new Date(),
  putTrail: async (item) => {
    await ddb.send(new PutCommand({ TableName: process.env.TRAIL_TABLE!, Item: item }));
  },
  putStatement: async (key, body) => {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.STATEMENTS_BUCKET!, Key: key, Body: body, ContentType: "application/json",
    }));
  },
});
