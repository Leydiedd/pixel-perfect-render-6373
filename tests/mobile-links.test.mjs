import test from "node:test";
import assert from "node:assert/strict";
import { destinoDolibarr, esPdfPortal } from "../src/lib/mobile-links.ts";
test("Dolibarr cards resolve the correct document type and identifier", () => {
  for (const [ruta, tipo, id] of [
    ["commande/card.php?id=1442", "pedido", 1442],
    ["compta/facture/card.php?facid=12", "factura", 12],
    ["product/card.php?id=2", "producto", 2],
    ["expedition/card.php?id=3", "expedicion", 3],
    ["societe/card.php?socid=99", "cliente", 99],
  ])
    assert.deepEqual(destinoDolibarr(ruta), { tipo, id });
});
test("unknown, external and invalid document links cannot select another portal record", () => {
  for (const ruta of [
    "javascript:alert(1)",
    "//example.com/commande/card.php?id=1",
    "../commande/card.php?id=1",
    "commande/card.php?id=0",
    "commande/card.php?id=1x",
    "compta/facture/card.php?id=1",
    "admin/const.php",
    "commande/list.php",
  ])
    assert.deepEqual(destinoDolibarr(ruta), { tipo: "erp" });
});
test("only authenticated portal PDF URLs use the embedded viewer", () => {
  assert.equal(esPdfPortal("/api/cuenta?documento=1442"), true);
  assert.equal(esPdfPortal("/api/dolibarr?documento=2"), true);
  for (const url of [
    "https://example.com/a.pdf",
    "/api/cuenta?documento=0",
    "/api/cuenta?documento=2&extra=1",
    "/admin/boletas?factura=2",
  ])
    assert.equal(esPdfPortal(url), false);
});
