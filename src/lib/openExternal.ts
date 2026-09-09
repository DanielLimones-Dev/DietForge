export async function openExternal(url: string) {
  const target = new URL(url, window.location.origin);
  if (target.protocol !== "https:" && target.protocol !== "http:") return;
  window.open(target.href, "_blank", "noopener,noreferrer");
}
