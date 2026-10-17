// Serve i file salvati in locale (.data/files) quando non c'è Vercel Blob: solo per lo sviluppo.
import fs from "node:fs/promises";
import { localFilePath } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", json: "application/json" };

export async function GET(_request: Request, { params }: RouteContext<"/api/files/[...path]">) {
  if (process.env.BLOB_READ_WRITE_TOKEN) return new Response("Not found", { status: 404 });
  const pathname = (await params).path.join("/");
  const full = localFilePath(pathname);
  const body = full ? await fs.readFile(full).catch(() => null) : null;
  if (!body) return new Response("Not found", { status: 404 });
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return new Response(new Uint8Array(body), {
    headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=3600" },
  });
}
