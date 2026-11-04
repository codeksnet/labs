import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DETAIL_TYPE, SOURCE, type ReservationCreated, type TrailItem } from "./contract";

export function configured() {
  return Boolean(process.env.EVENT_BUS_NAME && process.env.TRAIL_TABLE && process.env.AWS_REGION);
}

export async function emitReservation(detail: ReservationCreated) {
  const res = await new EventBridgeClient({}).send(new PutEventsCommand({
    Entries: [{ EventBusName: process.env.EVENT_BUS_NAME, Source: SOURCE, DetailType: DETAIL_TYPE, Detail: JSON.stringify(detail) }],
  }));
  if (res.FailedEntryCount) throw new Error(res.Entries?.[0]?.ErrorMessage ?? "PutEvents failed");
}

export async function readTrail(reservationId: string): Promise<TrailItem[]> {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const out = await ddb.send(new QueryCommand({
    TableName: process.env.TRAIL_TABLE,
    KeyConditionExpression: "pk = :p",
    ExpressionAttributeValues: { ":p": reservationId },
  }));
  return ((out.Items ?? []) as TrailItem[]).sort((a, b) => a.ts.localeCompare(b.ts));
}
