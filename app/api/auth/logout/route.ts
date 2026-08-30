import { NextResponse } from "next/server";
import { distruggiSessione } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await distruggiSessione();
  return NextResponse.json({ ok: true });
}
