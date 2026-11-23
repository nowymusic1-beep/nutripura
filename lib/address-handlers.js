// Buscador y verificador de direcciones de Chile con Geoapify (igual que en Pasión Fútbol).
// Geoapify solo recibe el texto de la dirección y la comuna, nunca el nombre ni otros datos del cliente.
import { isAllowedOrigin } from "./flow-handlers.js";

const geoapifyBase = "https://api.geoapify.com/v1/geocode";
const normText = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Número escrito al final de la calle ("Av. Providencia 1234"). Geoapify no tiene todos los números de Chile.
function typedStreetNumber(text) {
  const first = String(text || "").split(",")[0].trim();
  const match = first.match(/(?:^|\s)(\d{1,6}[A-Za-z]?)\s*$/);
  return match ? match[1] : "";
}

function geoCommune(p) {
  return String(p.city || p.town || p.village || p.municipality || p.suburb || "").trim();
}

// Caché corta en memoria: las búsquedas repetidas (muy comunes al borrar y reescribir) no vuelven a Geoapify.
const geoCache = new Map();
const GEO_CACHE_MAX = 300;
const GEO_CACHE_MS = 30 * 60 * 1000;

async function geoapifyRequest(endpoint, params) {
  const target = new URL(`${geoapifyBase}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  const cacheKey = target.href.toLowerCase();
  const hit = geoCache.get(cacheKey);
  if (hit && Date.now() - hit.at < GEO_CACHE_MS) return hit.result;
  target.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY);
  const response = await fetch(target.href, { signal: AbortSignal.timeout(6000) });
  const data = await response.json().catch(() => ({}));
  const result = { status: response.status, ok: response.ok, data };
  if (response.ok) {
    if (geoCache.size >= GEO_CACHE_MAX) geoCache.delete(geoCache.keys().next().value);
    geoCache.set(cacheKey, { at: Date.now(), result });
  }
  return result;
}

function geoFeatures(data) {
  return (Array.isArray(data?.features) ? data.features : [])
    .map((feature) => feature?.properties)
    .filter((p) => p && String(p.country_code || "").toLowerCase() === "cl" && p.street && typeof p.place_id === "string");
}

// Comprueba método, origen y configuración. Devuelve el cuerpo o null si ya respondió.
function readRequest(req, res) {
  if (req.method !== "POST") {
    res.set("Allow", "POST").status(405).json({ error: "Método no permitido." });
    return null;
  }
  const origin = req.get("origin");
  if (!origin || !isAllowedOrigin(origin, req)) {
    res.status(403).json({ error: "Origen no autorizado." });
    return null;
  }
  if (!process.env.GEOAPIFY_API_KEY) {
    res.status(503).json({ error: "Búsqueda de direcciones no configurada.", code: "MAPS_NOT_CONFIGURED" });
    return null;
  }
  const body = typeof req.body === "object" && req.body ? req.body : {};
  return {
    input: typeof body.input === "string" ? body.input.trim().slice(0, 200) : "",
    communeName: typeof body.communeName === "string" ? body.communeName.trim().slice(0, 80) : "",
    placeId: typeof body.placeId === "string" && /^[A-Za-z0-9_=-]{10,200}$/.test(body.placeId) ? body.placeId : "",
  };
}

function withCommune(input, communeName) {
  return communeName && !normText(input).includes(normText(communeName)) ? `${input}, ${communeName}` : input;
}

function geoFailure(res, result, label) {
  if (result.status === 429) {
    res.status(429).json({ error: "Límite de búsqueda alcanzado.", code: "RESOURCE_EXHAUSTED" });
  } else {
    console.error(`Geoapify ${label} respondió`, result.status, JSON.stringify(result.data).slice(0, 300));
    res.status(502).json({ error: "No pudimos buscar direcciones en este momento." });
  }
}

export async function addressAutocomplete(req, res) {
  const body = readRequest(req, res);
  if (!body) return;
  const { input, communeName } = body;
  if (input.length < 4 || input.length > 180) {
    res.json({ suggestions: [] });
    return;
  }
  const typed = typedStreetNumber(input);
  let result;
  try {
    result = await geoapifyRequest("autocomplete", {
      text: withCommune(input, communeName), lang: "es", limit: "6", format: "geojson", filter: "countrycode:cl",
    });
  } catch (error) {
    console.error("Autocompletar direcciones falló:", error?.message || error);
    res.status(502).json({ error: "No pudimos buscar direcciones en este momento." });
    return;
  }
  if (!result.ok) {
    geoFailure(res, result, "autocompletar");
    return;
  }
  const seen = new Set();
  const suggestions = [];
  for (const p of geoFeatures(result.data)) {
    const number = p.housenumber || typed;
    const mainText = number ? `${p.street} ${number}` : p.street;
    const commune = geoCommune(p);
    const region = String(p.state || "").trim();
    const place = [commune, region].filter(Boolean).join(", ");
    const text = place ? `${mainText}, ${place}` : mainText;
    if (seen.has(text)) continue;
    seen.add(text);
    // La sugerencia ya trae lo mismo que entrega la verificación, así el navegador no tiene que volver a preguntar.
    suggestions.push({
      placeId: p.place_id, text, mainText, secondaryText: place, commune, region,
      hasStreetNumber: Boolean(number), numberConfirmed: Boolean(p.housenumber),
      streetLine: mainText, formattedAddress: [mainText, commune, region].filter(Boolean).join(", "),
    });
  }
  res.set("Cache-Control", "no-store");
  res.json({ suggestions });
}

export async function addressVerify(req, res) {
  const body = readRequest(req, res);
  if (!body) return;
  const { input, communeName, placeId } = body;
  if (input.length < 3) {
    res.json({ status: "not_found", exists: false });
    return;
  }
  let result;
  try {
    result = await geoapifyRequest("search", {
      text: withCommune(input, communeName), lang: "es", limit: "5", format: "geojson", filter: "countrycode:cl",
    });
  } catch (error) {
    console.error("Verificar dirección falló:", error?.message || error);
    res.status(502).json({ error: "No pudimos verificar la dirección en este momento." });
    return;
  }
  if (!result.ok) {
    geoFailure(res, result, "verificar");
    return;
  }
  const found = geoFeatures(result.data);
  const p = found.find((item) => placeId && item.place_id === placeId) || found[0];
  if (!p) {
    res.json({ status: "not_found", exists: false });
    return;
  }
  const number = p.housenumber || typedStreetNumber(input);
  const commune = geoCommune(p);
  const region = String(p.state || "").trim();
  const base = { placeId: p.place_id, commune, region };
  if (!number) {
    res.json({ ...base, status: "route_only", exists: true, hasStreetNumber: false, streetLine: p.street,
      formattedAddress: [p.street, commune, region].filter(Boolean).join(", ") });
    return;
  }
  const streetLine = `${p.street} ${number}`;
  // Si el número no figura en el mapa, se acepta el que escribió el cliente y la calle sí queda confirmada.
  res.json({ ...base, status: "verified", exists: true, hasStreetNumber: true, numberConfirmed: Boolean(p.housenumber),
    streetLine, formattedAddress: [streetLine, commune, region].filter(Boolean).join(", ") });
}
