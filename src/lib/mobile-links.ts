export function destinoDolibarr(
  ruta: string,
):
  | { tipo: "pedido" | "factura" | "producto" | "expedicion" | "cliente"; id: number }
  | { tipo: "erp" } {
  if (!/^[a-zA-Z0-9_/.-]+(?:\?[^#]*)?$/.test(ruta) || ruta.startsWith("/") || ruta.includes(".."))
    return { tipo: "erp" };
  const url = new URL(ruta, "https://erp.invalid/");
  const rutas = {
    "/commande/card.php": ["pedido", "id"],
    "/compta/facture/card.php": ["factura", "facid"],
    "/product/card.php": ["producto", "id"],
    "/expedition/card.php": ["expedicion", "id"],
    "/societe/card.php": ["cliente", "socid"],
  } as const;
  const destino = rutas[url.pathname as keyof typeof rutas];
  if (!destino) return { tipo: "erp" };
  const id = url.searchParams.get(destino[1]);
  return id && /^[1-9]\d{0,9}$/.test(id) ? { tipo: destino[0], id: Number(id) } : { tipo: "erp" };
}

export function esPdfPortal(url: string) {
  return /^\/api\/(cuenta|dolibarr)\?documento=[1-9]\d{0,9}$/.test(url);
}
