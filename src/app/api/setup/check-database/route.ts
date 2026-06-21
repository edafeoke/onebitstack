import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/setup-checks";

export async function POST() {
  const result = await checkDatabase();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
