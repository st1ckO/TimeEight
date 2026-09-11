import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== requestOrigin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (request.headers.get("x-timeeight-confirm") !== "delete") {
    return NextResponse.json(
      { error: "Confirmation required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Account deletion is not configured" },
      { status: 503 },
    );
  }
  const { url } = getSupabaseConfig();
  const admin = createSupabaseClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error)
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
