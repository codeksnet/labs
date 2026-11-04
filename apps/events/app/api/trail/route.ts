import { NextResponse } from "next/server";
import { configured, readTrail } from "@/lib/aws";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("r") ?? "";
  if (!configured() || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json([], { status: 400 });
  return NextResponse.json(await readTrail(id));
}
