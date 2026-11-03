/** Cache-bust media URLs so a browser that stored a redirect to an expired R2 link refetches through the app. */
export function mediaSrc(url?: string | null): string {
  if (!url) return "";
  if (!url.startsWith("/api/files/")) return url;
  if (/[?&]v=/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "v=2";
}
