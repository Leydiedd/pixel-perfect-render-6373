const DOLIBARR_API_URL = "https://possession-corresponding-delight-pixel.trycloudflare.com/dolibarr/bimbo_v2/htdocs/api/index.php";
const DOLAPIKEY = "4Yu1gT3s6TUoLep0MZG7jOI8f62C8fhB";

export async function obtenerProductosDolibarr() {
  try {
    const response = await fetch(`${DOLIBARR_API_URL}/products?limit=50`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "DOLAPIKEY": DOLAPIKEY
      }
    });

    if (!response.ok) {
      throw new Error(`Error en Dolibarr API: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("No se pudo conectar a Dolibarr API. Usando catálogo local de emergencia.", error);
    return null; // Tu aplicación usará los datos locales estáticos si falla
  }
}