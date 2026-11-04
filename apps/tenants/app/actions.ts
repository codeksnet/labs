"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isTenantKey } from "@/lib/db";

export async function switchTenant(formData: FormData) {
  const t = String(formData.get("tenant"));
  if (isTenantKey(t)) (await cookies()).set("tenant", t, { path: "/", sameSite: "lax" });
  redirect("/");
}
