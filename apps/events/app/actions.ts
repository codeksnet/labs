"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { configured, emitReservation } from "@/lib/aws";
import { allow } from "@/lib/ratelimit";

export async function createReservation(formData: FormData) {
  if (!configured()) redirect("/?error=not-configured");
  if (!allow()) redirect("/?error=rate-limited");
  const guest = String(formData.get("guest") ?? "").trim().slice(0, 40) || "Guest";
  const nights = Math.min(30, Math.max(1, Number(formData.get("nights")) || 1));
  const reservationId = randomUUID();
  await emitReservation({ reservationId, guest, nights, simulateFailure: formData.get("fail") === "on" });
  redirect(`/?r=${reservationId}`);
}
