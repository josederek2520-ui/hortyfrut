const logos = new Set([
  "/images/marca/logo-hortyfru-claro-transparente.png",
  "/images/marca/logo-hortyfru-oscuro-transparente.png",
]);
const consultas = new Set([
  "ruta",
  "pedidos",
  "productos-pedido",
  "seguimiento",
  "posiciones-seguimiento",
]);
const operaciones = new Set([
  "iniciar",
  "llegar",
  "descargar-pedido",
  "finalizar",
  "calcular-ruta",
  "aprobar-ruta",
  "optimizar-ruta",
  "cancelar-optimizacion",
  "consultar-alternativas",
  "elegir-alternativa",
  "iniciar-seguimiento",
  "detener-seguimiento",
  "enviar-posiciones",
  "guia-destino",
]);

export function resolverDestino(ruta, metodo) {
  if (
    typeof ruta !== "string" ||
    !ruta.startsWith("/") ||
    /[\\#\x00-\x20]/.test(ruta) ||
    /%(?:25|2e|2f|5c|00|0a|0d)/i.test(ruta.split("?")[0]) ||
    ruta.startsWith("//")
  )
    return null;
  let enlace;
  try {
    enlace = new URL(ruta, "http://local.invalid");
    decodeURIComponent(enlace.pathname);
  } catch {
    return null;
  }
  const camino = enlace.pathname;
  if (camino.includes("//") || /(?:^|\/)\.{1,2}(?:\/|$)/.test(camino))
    return null;
  const lectura = ["GET", "HEAD"].includes(metodo);
  if (
    lectura &&
    /^\/(?:(?:es|en)\/)?entregas(?:\/[1-9]\d{0,14}\/[1-9]\d{0,14})?\/?$/.test(
      camino,
    )
  )
    return "web";
  if (lectura && /^\/api\/v1\/entregas\/?$/.test(camino)) return "api";
  if (
    /^\/api\/v1\/entregas\/[1-9]\d{0,14}\/pedidos\/[1-9]\d{0,14}\/?$/.test(
      camino,
    ) &&
    (lectura || metodo === "POST")
  )
    return "api";
  if (
    lectura &&
    /^\/api\/v1\/entregas\/[1-9]\d{0,14}\/pedidos\/[1-9]\d{0,14}\/(?:productos|aportes|comprobante|imagenes\/[1-9]\d{0,14})\/?$/.test(
      camino,
    )
  )
    return "api";
  if (
    metodo === "POST" &&
    /^\/api\/v1\/entregas\/[1-9]\d{0,14}\/pedidos\/[1-9]\d{0,14}\/(?:enviar|comprobante)\/?$/.test(
      camino,
    )
  )
    return "api";
  if (lectura && camino === "/sonidos/notificacion-chat.mp3") return "web";
  if (lectura && /^\/(?:(?:es|en)\/)?chat\/?$/.test(camino)) return "web";
  if (
    lectura &&
    /^\/api\/v1\/chat\/(?:usuarios|conversaciones|resumen)\/?$/.test(camino)
  )
    return "api";
  if (
    metodo === "POST" &&
    /^\/api\/v1\/chat\/(?:conversaciones|acceso)\/?$/.test(camino)
  )
    return "api";
  if (
    /^\/api\/v1\/chat\/conversaciones\/[1-9]\d{0,14}\/mensajes\/?$/.test(
      camino,
    ) &&
    (lectura || metodo === "POST")
  )
    return "api";
  if (
    /^\/api\/v1\/chat\/conversaciones\/[1-9]\d{0,14}\/lectura\/?$/.test(
      camino,
    ) &&
    metodo === "POST"
  )
    return "api";
  if (
    lectura &&
    /^\/mapas\/maplibre\/\d{1,3}\.\d{1,3}\.\d{1,3}\/(?:worker\.mjs|LICENSE\.txt)$/.test(
      camino,
    )
  )
    return "web";
  if (lectura && camino === "/") return "inicio";
  if (
    lectura &&
    /^\/(?:(?:es|en)\/)?(?:signin|profile|mis-viajes(?:\/[1-9]\d{0,14})?)\/?$/.test(
      camino,
    )
  )
    return "web";
  if (
    lectura &&
    /^\/_next\/static\/[a-zA-Z0-9_./%[\]()-]+$/.test(camino) &&
    !camino.endsWith(".map")
  )
    return "web";
  if (lectura && (logos.has(camino) || camino === "/favicon.ico")) return "web";
  if (
    lectura &&
    camino === "/_next/image" &&
    logos.has(enlace.searchParams.get("url"))
  ) {
    if (
      [...enlace.searchParams.keys()].some(
        (clave) => !["url", "w", "q"].includes(clave),
      )
    )
      return null;
    return "web";
  }
  const normal = camino.replace(/\/$/, "");
  if (lectura && /^\/api\/v1\/auth\/(?:csrf|me|profile)$/.test(normal))
    return "api";
  if (
    metodo === "POST" &&
    /^\/api\/v1\/auth\/(?:login|logout|profile\/password)$/.test(normal)
  )
    return "api";
  if (metodo === "PATCH" && normal === "/api/v1/auth/profile") return "api";
  if (metodo === "POST" && normal === "/api/v1/chofer/acceso") return "api";
  if (
    lectura &&
    /^\/api\/v1\/chofer\/mis-viajes\/[1-9]\d{0,14}\/imagenes\/[1-9]\d{0,14}$/.test(
      normal,
    )
  )
    return "api";
  if (lectura && normal === "/api/v1/chofer/mis-viajes") return "api";
  const coincidencia = normal.match(
    /^\/api\/v1\/chofer\/mis-viajes\/([1-9]\d{0,14})(?:\/([a-z-]+))?$/,
  );
  if (!coincidencia || !Number.isSafeInteger(Number(coincidencia[1])))
    return null;
  if (lectura && (!coincidencia[2] || consultas.has(coincidencia[2])))
    return "api";
  if (metodo === "POST" && operaciones.has(coincidencia[2])) return "api";
  return null;
}
