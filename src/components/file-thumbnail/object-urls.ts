/** A File can appear in the composer and transcript at once. Release the URL
 * only after the last mounted thumbnail stops using that exact File object. */
const urls = new Map<File, { url: string; users: number }>();
export function retainObjectUrl(file: File): {
  readonly url: string;
  readonly release: () => void;
} {
  let entry = urls.get(file);
  if (!entry) {
    entry = { url: URL.createObjectURL(file), users: 0 };
    urls.set(file, entry);
  }
  entry.users++;
  const held = entry;
  let released = false;
  return {
    url: held.url,
    release: () => {
      if (released) return;
      released = true;
      if (--held.users === 0) {
        URL.revokeObjectURL(held.url);
        urls.delete(file);
      }
    },
  };
}
const identities = new WeakMap<File, string>();
let sequence = 0;
/** Identity, rather than filename/mtime, detects replacing an attachment with
 * another File that happens to have the same metadata. */
export function fileIdentity(file: File): string {
  let key = identities.get(file);
  if (!key) {
    key = String(++sequence);
    identities.set(file, key);
  }
  return key;
}
