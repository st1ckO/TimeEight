import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    {
      error:
        "Automatic timer pausing is disabled. Resolve the timer from the recovery prompt.",
    },
    { status: 410 },
  );
}
