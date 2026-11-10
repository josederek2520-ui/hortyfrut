import {
  createServer as crearServidor,
  request as solicitarHttp,
} from "node:http";
import { timingSafeEqual as comparar } from "node:crypto";
import { isIP as esDireccionIp } from "node:net";
import { resolverDestino } from "./politica_rutas.mjs";
import { validarOrigen } from "./configuracion.mjs";

const encabezadosPermitidos = [
  "accept",
  "accept-language",
  "accept-encoding",
  "user-agent",
  "cookie",
  "content-type",
  "origin",
  "referer",
  "x-csrftoken",
  "x-usuario-chat",
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  // Next valida la huella RSC con este contexto; retirarlo cambia la navegacion.
  "next-url",
  "if-none-match",
  "if-modified-since",
];
function responder(respuesta, estado, detalle) {
  respuesta.writeHead(estado, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "geolocation=(self)",
  });
  respuesta.end(JSON.stringify({ detail: detalle }));
}
function claveValida(recibida, esperada) {
  return (
    typeof recibida === "string" &&
    recibida.length === esperada.length &&
    comparar(Buffer.from(recibida), Buffer.from(esperada))
  );
}
async function leerCuerpo(solicitud, limite = 65536) {
  const partes = [];
  let cantidad = 0;
  for await (const parte of solicitud) {
    cantidad += parte.length;
    if (cantidad > limite) throw new Error("cuerpo_excesivo");
    partes.push(parte);
  }
  return Buffer.concat(partes);
}

export function crearPasarela({
  obtenerEstado,
  claveControl,
  alDetener,
  puertos,
  puertoChat = 8002,
}) {
  const servidor = crearServidor(
    { maxHeaderSize: 32768 },
    async (solicitud, respuesta) => {
      const estado = obtenerEstado();
      if (
        solicitud.url === "/__control-chofer" &&
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
          solicitud.socket.remoteAddress,
        ) &&
        /^127\.0\.0\.1:\d+$/.test(solicitud.headers.host ?? "") &&
        claveValida(solicitud.headers["x-control-chofer"], claveControl)
      ) {
        if (solicitud.method === "GET")
          return responder(respuesta, 200, {
            estado: estado.estado,
            origen: estado.origen,
            pid: process.pid,
            puertos,
          });
        if (solicitud.method === "POST") {
          responder(respuesta, 200, "Deteniendo el acceso del chofer.");
          setImmediate(alDetener);
          return;
        }
      }
      if (!validarOrigen(estado.origen))
        return responder(
          respuesta,
          503,
          "El acceso del chofer se está preparando.",
        );
      const publico = new URL(estado.origen);
      if (solicitud.headers.host !== publico.host)
        return responder(respuesta, 421, "Dirección no autorizada.");
      if (solicitud.headers["x-forwarded-proto"] !== "https") {
        respuesta.writeHead(308, {
          Location: `${estado.origen}/chat`,
          "Cache-Control": "no-store",
        });
        respuesta.end();
        return;
      }
      const destino = resolverDestino(solicitud.url, solicitud.method);
      if (!destino)
        return responder(
          respuesta,
          404,
          "Esta dirección no está disponible en el acceso del chofer.",
        );
      if (destino === "inicio") {
        respuesta.writeHead(307, {
          Location: "/chat",
          "Cache-Control": "no-store",
        });
        respuesta.end();
        return;
      }
      const escritura = !["GET", "HEAD"].includes(solicitud.method);
      const caminoSolicitud = new URL(solicitud.url, estado.origen).pathname;
      const adjuntoEntrega =
        /^\/api\/v1\/entregas\/[1-9]\d{0,14}\/pedidos\/[1-9]\d{0,14}\/comprobante\/?$/.test(
          caminoSolicitud,
        );
      const limiteCuerpo = adjuntoEntrega
        ? 8 * 1024 * 1024 + 65536
        : caminoSolicitud.startsWith("/api/v1/entregas/")
          ? 1024 * 1024
          : 65536;
      if (escritura && solicitud.headers.origin !== estado.origen)
        return responder(respuesta, 403, "Origen no autorizado.");
      if (
        escritura &&
        !(
          adjuntoEntrega &&
          /^multipart\/form-data\s*;/i.test(
            solicitud.headers["content-type"] ?? "",
          )
        ) &&
        !/^application\/json(?:\s*;|$)/i.test(
          solicitud.headers["content-type"] ?? "",
        )
      )
        return responder(respuesta, 415, "Envía los datos en formato JSON.");
      if (Number(solicitud.headers["content-length"] ?? 0) > limiteCuerpo)
        return responder(
          respuesta,
          413,
          "La solicitud supera el tamaño permitido.",
        );
      let cuerpo;
      try {
        cuerpo = escritura ? await leerCuerpo(solicitud, limiteCuerpo) : null;
      } catch {
        if (!respuesta.destroyed)
          responder(respuesta, 413, "La solicitud supera el tamaño permitido.");
        return;
      }
      const encabezados = Object.fromEntries(
        encabezadosPermitidos
          .filter((clave) => solicitud.headers[clave] !== undefined)
          .map((clave) => [clave, solicitud.headers[clave]]),
      );
      // Next hace sus reescrituras internas sobre HTTP loopback; Django recibe el
      // origen público HTTPS para validar sesión y CSRF sin exponer su puerto.
      encabezados.host =
        destino === "api" ? publico.host : `localhost:${puertos.web}`;
      encabezados["x-forwarded-proto"] = destino === "api" ? "https" : "http";
      const direccionCliente = solicitud.headers["cf-connecting-ip"];
      encabezados["x-forwarded-for"] =
        typeof direccionCliente === "string" && esDireccionIp(direccionCliente)
          ? direccionCliente
          : "127.0.0.1";
      if (cuerpo) encabezados["content-length"] = String(cuerpo.length);
      const enlace = new URL(solicitud.url, estado.origen);
      const camino =
        destino === "api"
          ? `${enlace.pathname.replace(/\/$/, "")}/${enlace.search}`
          : solicitud.url;
      const transporte = solicitarHttp(
        {
          hostname: destino === "api" ? "127.0.0.1" : "localhost",
          port: destino === "api" ? puertos.api : puertos.web,
          method: solicitud.method,
          path: camino,
          headers: encabezados,
          timeout: 70000,
        },
        (remota) => {
          remota.on("error", () => {
            if (!respuesta.headersSent)
              responder(
                respuesta,
                503,
                "La respuesta se interrumpió. Intenta nuevamente.",
              );
            else respuesta.destroy();
          });
          if ((remota.statusCode ?? 502) >= 500) {
            remota.resume();
            responder(
              respuesta,
              503,
              "El servicio no está disponible. Intenta nuevamente.",
            );
            return;
          }
          const cabeceras = {
            ...remota.headers,
            "x-content-type-options": "nosniff",
            "permissions-policy": "geolocation=(self)",
            "x-frame-options": "DENY",
            "referrer-policy": "same-origin",
          };
          for (const clave of [
            "server",
            "x-powered-by",
            "connection",
            "keep-alive",
            "transfer-encoding",
          ])
            delete cabeceras[clave];
          if (
            destino === "api" ||
            /text\/html|text\/x-component/.test(
              String(cabeceras["content-type"]),
            )
          )
            cabeceras["cache-control"] = "private, no-store";
          if (cabeceras.location) {
            const redireccion = new URL(cabeceras.location, estado.origen);
            if (
              redireccion.origin !== estado.origen &&
              !["127.0.0.1", "localhost"].includes(redireccion.hostname)
            ) {
              remota.resume();
              responder(respuesta, 502, "Redirección no autorizada.");
              return;
            }
            if (
              !resolverDestino(redireccion.pathname + redireccion.search, "GET")
            ) {
              remota.resume();
              responder(respuesta, 404, "Dirección no disponible.");
              return;
            }
            cabeceras.location = redireccion.pathname + redireccion.search;
          }
          respuesta.writeHead(remota.statusCode ?? 502, cabeceras);
          remota.pipe(respuesta);
        },
      );
      transporte.on("timeout", () => transporte.destroy());
      transporte.on("error", () => {
        if (!respuesta.headersSent)
          responder(
            respuesta,
            503,
            "El servicio no está disponible. Intenta nuevamente.",
          );
        else respuesta.destroy();
      });
      respuesta.on("close", () => {
        if (!respuesta.writableFinished) transporte.destroy();
      });
      transporte.end(cuerpo ?? undefined);
    },
  );
  servidor.headersTimeout = 15000;
  servidor.requestTimeout = 30000;
  servidor.on("upgrade", (solicitud, conexion, cabecera) => {
    const estado = obtenerEstado();
    if (!permitirCanalChat(solicitud, estado)) {
      conexion.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    const transporte = solicitarHttp({
      hostname: "127.0.0.1",
      port: puertoChat,
      path: "/ws/chat/",
      method: "GET",
      headers: {
        host: `127.0.0.1:${puertoChat}`,
        origin: estado.origen,
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-key": solicitud.headers["sec-websocket-key"],
        "sec-websocket-version": "13",
      },
      timeout: 8000,
    });
    transporte.on("upgrade", (respuesta, canal, restante) => {
      transporte.setTimeout(0);
      canal.setTimeout(0);
      conexion.setTimeout(0);
      conexion.setNoDelay(true);
      canal.setNoDelay(true);
      conexion.write(
        `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${respuesta.headers["sec-websocket-accept"]}\r\n\r\n`,
      );
      if (cabecera.length) canal.write(cabecera);
      if (restante.length) conexion.write(restante);
      canal.on("error", () => conexion.destroy());
      conexion.on("error", () => canal.destroy());
      canal.on("close", () => conexion.destroy());
      conexion.on("close", () => canal.destroy());
      canal.pipe(conexion);
      conexion.pipe(canal);
    });
    transporte.on("response", (respuesta) => {
      respuesta.resume();
      conexion.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    });
    transporte.on("timeout", () => transporte.destroy());
    transporte.on("error", () => conexion.destroy());
    conexion.once("close", () => transporte.destroy());
    transporte.end();
  });
  return servidor;
}

export function permitirCanalChat(solicitud, estado) {
  if (
    !validarOrigen(estado.origen) ||
    solicitud.method !== "GET" ||
    !["/ws/chat", "/ws/chat/"].includes(solicitud.url)
  )
    return false;
  const clave = solicitud.headers["sec-websocket-key"];
  return (
    solicitud.headers.host === new URL(estado.origen).host &&
    solicitud.headers.origin === estado.origen &&
    solicitud.headers["x-forwarded-proto"] === "https" &&
    solicitud.headers["sec-websocket-version"] === "13" &&
    String(solicitud.headers.upgrade).toLowerCase() === "websocket" &&
    typeof clave === "string" &&
    /^[A-Za-z0-9+/]{22}==$/.test(clave)
  );
}
