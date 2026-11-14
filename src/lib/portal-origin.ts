/** LAN access is opt-in for one exact origin; forwarded headers never grant access. */
export function origenPortalPermitido(url: URL): boolean {
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return true;
  const allowed = typeof process !== "undefined" ? process.env["BIMBO_LAN_ORIGIN"] : undefined;
  return !!allowed && url.origin === allowed;
}
