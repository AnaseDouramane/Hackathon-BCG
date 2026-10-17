// File salvati a runtime (snapshot dell'analisi, foto delle piante).
// Su Vercel: Vercel Blob (BLOB_READ_WRITE_TOKEN, store "public"). In locale senza token: la cartella
// .data/files, servita da /api/files/... — così si prova tutto anche senza Blob.
// Si scrive sempre su percorsi nuovi (mai sovrascrivere): la CDN del Blob potrebbe servire versioni vecchie.
import fs from "node:fs/promises";
import path from "node:path";
import { copy, del, get, list, put } from "@vercel/blob";

export type StoredFile = { pathname: string; url: string; uploadedAt: Date };

const LOCAL_ROOT = path.join(process.cwd(), ".data", "files");

const onBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/** Spento nei test (FILE_STORAGE=off) e su Vercel senza Blob, dove il disco è in sola lettura. */
export function isStorageEnabled(): boolean {
  if (process.env.FILE_STORAGE === "off") return false;
  return onBlob() || !process.env.VERCEL;
}

export function localFilePath(pathname: string): string | null {
  const full = path.resolve(LOCAL_ROOT, pathname);
  return full.startsWith(LOCAL_ROOT + path.sep) ? full : null;
}

const localUrl = (pathname: string) => `/api/files/${pathname}`;

export async function putFile(pathname: string, body: Buffer | string, contentType: string): Promise<StoredFile> {
  if (onBlob()) {
    const blob = await put(pathname, body, { access: "public", contentType, addRandomSuffix: false });
    return { pathname: blob.pathname, url: blob.url, uploadedAt: new Date() };
  }
  const full = localFilePath(pathname);
  if (!full) throw new Error(`Invalid pathname: ${pathname}`);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
  return { pathname, url: localUrl(pathname), uploadedAt: new Date() };
}

/** Tutti i file sotto un prefisso (es. "photos/pending/"), in ordine di pathname. */
export async function listFiles(prefix: string): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  if (onBlob()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      for (const b of page.blobs) files.push({ pathname: b.pathname, url: b.url, uploadedAt: new Date(b.uploadedAt) });
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  } else {
    const entries = await fs.readdir(LOCAL_ROOT, { recursive: true, withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(entry.parentPath, entry.name);
      const pathname = path.relative(LOCAL_ROOT, full).split(path.sep).join("/");
      if (!pathname.startsWith(prefix)) continue;
      const { mtime } = await fs.stat(full);
      files.push({ pathname, url: localUrl(pathname), uploadedAt: mtime });
    }
  }
  return files.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

export async function readFileText(pathname: string): Promise<string | null> {
  if (onBlob()) {
    const result = await get(pathname, { access: "public", useCache: false });
    return result?.statusCode === 200 ? new Response(result.stream).text() : null;
  }
  const full = localFilePath(pathname);
  return full ? fs.readFile(full, "utf8").catch(() => null) : null;
}

export async function readFileBytes(file: StoredFile): Promise<Buffer> {
  if (onBlob()) {
    const result = await get(file.pathname, { access: "public", useCache: false });
    if (result?.statusCode !== 200) throw new Error(`File not found: ${file.pathname}`);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  const full = localFilePath(file.pathname);
  if (!full) throw new Error(`Invalid pathname: ${file.pathname}`);
  return fs.readFile(full);
}

export async function moveFile(file: StoredFile, toPathname: string): Promise<StoredFile> {
  if (onBlob()) {
    const copied = await copy(file.url, toPathname, { access: "public", addRandomSuffix: false });
    await del(file.url);
    return { pathname: copied.pathname, url: copied.url, uploadedAt: new Date() };
  }
  const from = localFilePath(file.pathname);
  const to = localFilePath(toPathname);
  if (!from || !to) throw new Error(`Invalid pathname: ${file.pathname} → ${toPathname}`);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
  return { pathname: toPathname, url: localUrl(toPathname), uploadedAt: new Date() };
}

export async function deleteFiles(files: StoredFile[]): Promise<void> {
  if (!files.length) return;
  if (onBlob()) {
    await del(files.map((f) => f.url));
    return;
  }
  await Promise.all(files.map((f) => localFilePath(f.pathname)).map((full) => full && fs.rm(full, { force: true })));
}
