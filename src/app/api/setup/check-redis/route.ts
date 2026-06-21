import { NextResponse } from "next/server";
import { checkRedis } from "@/lib/setup-checks";

export async function POST() {
  const result = await checkRedis();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
