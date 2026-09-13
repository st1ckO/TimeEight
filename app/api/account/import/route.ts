import { NextResponse } from "next/server";
import { MAX_BACKUP_BYTES, prepareBackup } from "@/lib/domain/backup";
import { localDateAt } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (request.headers.get("x-timeeight-confirm") !== "CONFIRM")
    return NextResponse.json(
      { error: "Confirmation required" },
      { status: 400 },
    );
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let backup;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing file");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BACKUP_BYTES) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Backup exceeds 5 MB" },
          { status: 413 },
        );
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    backup = prepareBackup(
      raw,
      data.user.id,
      localDateAt(new Date(data.user.created_at), "UTC"),
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid TimeEight backup" },
      { status: 400 },
    );
  }
  const { error } = await client.rpc("restore_account_backup", {
    backup: backup as unknown as Json,
    confirmation: "CONFIRM",
  });
  if (error)
    return NextResponse.json(
      { error: "Restore failed. Your existing account data was not replaced." },
      { status: 500 },
    );
  return NextResponse.json(backup, {
    headers: { "Cache-Control": "no-store" },
  });
}
