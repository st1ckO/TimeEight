import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const pauseRequest = z.object({
  timerIds: z.array(z.string().uuid()).max(100),
});

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const parsed = pauseRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (parsed.data.timerIds.length > 0) {
    const { error } = await supabase
      .from("active_timers")
      .delete()
      .in("id", parsed.data.timerIds);
    if (error)
      return NextResponse.json({ error: "Pause failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
