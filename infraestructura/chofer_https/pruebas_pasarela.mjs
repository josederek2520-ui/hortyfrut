import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import {
  createServer as crearServidor,
  request as solicitarHttp,
} from "node:http";
import { once as esperarEvento } from "node:events";
import { createRequire as crearRequire } from "node:module";
import { resolverDestino } from "./politica_rutas.mjs";
import { crearPasarela, permitirCanalChat } from "./pasarela_chofer.mjs";

prueba(
  "Entregas publica solo la recepción propia y deja la confirmación en local",
  () => {
    for (const ruta of ["/entregas", "/entregas/7/12", "/en/entregas/7/12"])
      afirmar.equal(resolverDestino(ruta, "GET"), "web");
    for (const ruta of [
      "/api/v1/entregas/",
      "/api/v1/entregas/7/pedidos/12/",
      "/api/v1/entregas/7/pedidos/12/productos/",
      "/api/v1/entregas/7/pedidos/12/aportes/?producto=4",
      "/api/v1/entregas/7/pedidos/12/imagenes/4/",
      "/api/v1/entregas/7/pedidos/12/comprobante/",
    ])
      afirmar.equal(resolverDestino(ruta, "GET"), "api");
    for (const ruta of [
      "/api/v1/entregas/7/pedidos/12/",
      "/api/v1/entregas/7/pedidos/12/enviar/",
      "/api/v1/entregas/7/pedidos/12/comprobante/",
    ])
      afirmar.equal(resolverDestino(ruta, "POST"), "api");
    for (const ruta of [
      "/api/v1/entregas/7/pedidos/12/confirmar/",
      "/api/v1/entregas/7/pedidos/12/devolver/",
      "/api/v1/entregas/7/pedidos/12/imagenes/4/",
    ])
      afirmar.equal(resolverDestino(ruta, "POST"), null);
    afirmar.equal(resolverDestino("/entregas/7/12/editar", "GET"), null);
  },
);

const require = crearRequire(import.meta.url);
const {
  computeCacheBustingSearchParam: calcularHuellaRsc,
} = require("../../Frontend/node_modules/next/dist/shared/lib/router/utils/cache-busting-search-param.js");

prueba(
  "el túnel solo permite el chofer, su cuenta, sus recursos y sus API",
  () => {
    for (const ruta of [
      "/mis-viajes",
      "/chat",
      "/sonidos/notificacion-chat.mp3",
      "/mis-viajes/3",
      "/es/mis-viajes/3",
      "/en/signin",
      "/signin",
      "/profile",
      "/_next/static/chunks/app-123.js",
      "/favicon.ico",
      "/mapas/maplibre/6.16.0/worker.mjs",
      "/mapas/maplibre/6.16.0/LICENSE.txt",
    ])
      afirmar.equal(resolverDestino(ruta, "GET"), "web", ruta);
    for (const ruta of [
      "/api/v1/auth/csrf/",
      "/api/v1/auth/me/",
      "/api/v1/chat/usuarios/?pagina=2",
      "/api/v1/chat/conversaciones/3/mensajes/",
      "/api/v1/chofer/mis-viajes/?page=2",
      "/api/v1/chofer/mis-viajes/3/ruta/",
      "/api/v1/chofer/mis-viajes/3/imagenes/5/",
    ])
      afirmar.equal(resolverDestino(ruta, "GET"), "api", ruta);
    afirmar.equal(
      resolverDestino("/api/v1/chofer/mis-viajes/3/imagenes/5/", "HEAD"),
      "api",
    );
    afirmar.equal(
      resolverDestino("/api/v1/chofer/mis-viajes/3/imagenes/5/", "POST"),
      null,
    );
    for (const ruta of [
      "/api/v1/chofer/acceso/",
      "/api/v1/chat/acceso/",
      "/api/v1/chat/conversaciones/3/lectura/",
      "/api/v1/chofer/mis-viajes/3/descargar-pedido/",
      "/api/v1/chofer/mis-viajes/3/consultar-alternativas/",
      "/api/v1/chofer/mis-viajes/3/elegir-alternativa/",
      "/api/v1/chofer/mis-viajes/3/guia-destino/",
      "/api/v1/auth/login/",
    ])
      afirmar.equal(resolverDestino(ruta, "POST"), "api", ruta);
  },
);
prueba(
  "no se puede alcanzar administración ni saltar la lista de rutas con codificaciones",
  () => {
    for (const ruta of [
      "/admin",
      "/usuarios",
      "/despachos",
      "/seguimiento-camiones",
      "/api/v1/despachos/viajes-actuales/",
      "/mapas/maplibre/6.16.0/worker.mjs.map",
      "/mapas/maplibre/6.16.0/otro.mjs",
      "/api/v1/usuarios/",
      "/api/v1/despachos/3/iniciar/",
      "/api/v1/despachos/3/supervision/",
      "/api/v1/despachos/3/acceso-supervision/",
      "/ws/seguimiento/3/",
      "/__supervision/control",
      "/api/v1/chat/conversaciones/3/eliminar/",
      "/sonidos/otro.mp3",
      "/api/v1/movil/iniciar-sesion/",
      "/api/v1/chofer/mis-viajes/3/descargar/",
      "/api/v1/chofer/mis-viajes/3/cancelar/",
      "/_next/../admin",
      "/_next/static/../../admin",
      "/mis-viajes%2f..%2fadmin",
      "/mis-viajes%252fadmin",
      "//admin",
      "/mis-viajes\\admin",
      "/_next/static/chunk.js.map",
      "/__nextjs_original-stack-frame",
      "/_next/image?url=%2Fapi%2Fv1%2Fusuarios%2F&w=100&q=75",
      "/_next/image?url=https%3A%2F%2Fexample.com%2Fimagen.png",
    ])
      afirmar.equal(
        resolverDestino(ruta, "POST") ?? resolverDestino(ruta, "GET"),
        null,
        ruta,
      );
    afirmar.equal(
      resolverDestino(
        "/_next/image?url=%2Fimages%2Fmarca%2Flogo-hortyfru-claro-transparente.png&w=256&q=75",
        "GET",
      ),
      "web",
    );
    afirmar.equal(resolverDestino("/api/v1/auth/me/", "DELETE"), null);
    afirmar.equal(resolverDestino("/mis-viajes", "POST"), null);
  },
);

prueba(
  "solo el canal de Chat con el origen HTTPS exacto admite upgrade publico",
  () => {
    const origen = "https://prueba-chofer.trycloudflare.com";
    const solicitud = {
      method: "GET",
      url: "/ws/chat/",
      headers: {
        host: "prueba-chofer.trycloudflare.com",
        origin: origen,
        "x-forwarded-proto": "https",
        "sec-websocket-version": "13",
        "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
        upgrade: "websocket",
      },
    };
    afirmar.equal(permitirCanalChat(solicitud, { origen }), true);
    for (const url of [
      "/ws/seguimiento/3/",
      "/ws/chat/?acceso=secreto",
      "/ws/chat%2f",
      "/ws/otro/",
    ])
      afirmar.equal(
        permitirCanalChat({ ...solicitud, url }, { origen }),
        false,
      );
    afirmar.equal(
      permitirCanalChat(
        {
          ...solicitud,
          headers: {
            ...solicitud.headers,
            origin: "https://ajeno.trycloudflare.com",
          },
        },
        { origen },
      ),
      false,
    );
    afirmar.equal(
      permitirCanalChat({ ...solicitud, method: "POST" }, { origen }),
      false,
    );
  },
);

async function consultar(
  puerto,
  ruta,
  { metodo = "GET", encabezados = {}, cuerpo } = {},
) {
  return new Promise((resolver, rechazar) => {
    const peticion = solicitarHttp(
      {
        hostname: "127.0.0.1",
        port: puerto,
        path: ruta,
        method: metodo,
        headers: {
          Host: "prueba-chofer.trycloudflare.com",
          "X-Forwarded-Proto": "https",
          ...encabezados,
        },
      },
      (respuesta) => {
        let texto = "";
        respuesta.on("data", (datos) => {
          texto += datos;
        });
        respuesta.on("end", () =>
          resolver({
            estado: respuesta.statusCode,
            encabezados: respuesta.headers,
            texto,
          }),
        );
      },
    );
    peticion.on("error", rechazar);
    peticion.end(cuerpo);
  });
}

prueba(
  "los comprobantes admiten multipart acotado sin ampliar las demás operaciones",
  async () => {
    let recibidas = 0,
      cantidad = 0;
    const destino = crearServidor(async (solicitud, respuesta) => {
      recibidas += 1;
      cantidad = 0;
      for await (const parte of solicitud) cantidad += parte.length;
      respuesta.writeHead(200, { "Content-Type": "application/json" });
      respuesta.end("{}");
    });
    destino.listen(0, "127.0.0.1");
    await esperarEvento(destino, "listening");
    const origen = "https://prueba-chofer.trycloudflare.com";
    const pasarela = crearPasarela({
      obtenerEstado: () => ({ estado: "listo", origen }),
      claveControl: "a".repeat(64),
      alDetener: () => {},
      puertos: { api: destino.address().port, web: destino.address().port },
    });
    pasarela.listen(0, "127.0.0.1");
    await esperarEvento(pasarela, "listening");
    const puerto = pasarela.address().port;
    const cuerpo =
      '--prueba\r\nContent-Disposition: form-data; name="comprobante"; filename="prueba.pdf"\r\nContent-Type: application/pdf\r\n\r\n' +
      "x".repeat(70000) +
      "\r\n--prueba--";
    const encabezados = {
      Origin: origen,
      "Content-Type": "multipart/form-data; boundary=prueba",
      "Content-Length": Buffer.byteLength(cuerpo),
    };
    try {
      const bien = await consultar(
        puerto,
        "/api/v1/entregas/7/pedidos/12/comprobante/",
        { metodo: "POST", cuerpo, encabezados },
      );
      afirmar.equal(bien.estado, 200);
      afirmar.equal(cantidad, Buffer.byteLength(cuerpo));
      const mal = await consultar(puerto, "/api/v1/chofer/acceso/", {
        metodo: "POST",
        cuerpo,
        encabezados,
      });
      afirmar.equal(mal.estado, 415);
      afirmar.equal(recibidas, 1);
      const grande = await consultar(
        puerto,
        "/api/v1/entregas/7/pedidos/12/comprobante/",
        {
          metodo: "POST",
          cuerpo: "",
          encabezados: { ...encabezados, "Content-Length": 9 * 1024 * 1024 },
        },
      );
      afirmar.equal(grande.estado, 413);
      afirmar.equal(recibidas, 1);
    } finally {
      pasarela.closeAllConnections();
      destino.closeAllConnections();
      await Promise.all([
        new Promise((resolver) => pasarela.close(resolver)),
        new Promise((resolver) => destino.close(resolver)),
      ]);
    }
  },
);
prueba(
  "Chat y los viajes conservan el contexto y la huella de navegacion de Next",
  async () => {
    const arbol = encodeURIComponent(
      JSON.stringify(["", { children: ["mis-viajes", {}] }]),
    );
    const contexto = "/mis-viajes";
    const destino = crearServidor(async (solicitud, respuesta) => {
      const cabeceras = solicitud.headers;
      const esperada = await calcularHuellaRsc(
        cabeceras["next-router-prefetch"],
        cabeceras["next-router-segment-prefetch"],
        cabeceras["next-router-state-tree"],
        cabeceras["next-url"],
      );
      const enlace = new URL(solicitud.url, "http://localhost");
      if (enlace.searchParams.get("_rsc") !== esperada) {
        respuesta.writeHead(307, {
          Location: enlace.pathname + "?_rsc=" + esperada,
        });
        respuesta.end();
        return;
      }
      respuesta.writeHead(200, {
        "Content-Type": "text/x-component",
        Vary: "rsc,next-url,next-router-state-tree",
      });
      respuesta.end('0:{"f":[]}\n');
    });
    destino.listen(0);
    await esperarEvento(destino, "listening");
    const pasarela = crearPasarela({
      obtenerEstado: () => ({
        estado: "listo",
        origen: "https://prueba-chofer.trycloudflare.com",
      }),
      claveControl: "a".repeat(64),
      alDetener: () => {},
      puertos: { api: destino.address().port, web: destino.address().port },
    });
    pasarela.listen(0, "127.0.0.1");
    await esperarEvento(pasarela, "listening");
    try {
      for (const ruta of ["/chat", "/mis-viajes/5"]) {
        for (const precarga of [undefined, "1"]) {
          const huella = await calcularHuellaRsc(
            precarga,
            undefined,
            arbol,
            contexto,
          );
          const resultado = await consultar(
            pasarela.address().port,
            ruta + "?_rsc=" + huella,
            {
              encabezados: {
                rsc: "1",
                "next-url": contexto,
                "next-router-state-tree": arbol,
                ...(precarga ? { "next-router-prefetch": precarga } : {}),
              },
            },
          );
          afirmar.equal(
            resultado.estado,
            200,
            "El enlace no debe redirigir por una huella alterada",
          );
          afirmar.equal(
            resultado.encabezados["content-type"],
            "text/x-component",
          );
          afirmar.equal(
            resultado.encabezados["cache-control"],
            "private, no-store",
          );
          afirmar.equal(resultado.encabezados.location, undefined);
        }
      }
      afirmar.equal(
        (
          await consultar(pasarela.address().port, "/usuarios", {
            encabezados: { "next-url": "/chat" },
          })
        ).estado,
        404,
      );
    } finally {
      pasarela.closeAllConnections();
      destino.closeAllConnections();
      await Promise.all([
        new Promise((resolver) => pasarela.close(resolver)),
        new Promise((resolver) => destino.close(resolver)),
      ]);
    }
  },
);
prueba(
  "la pasarela exige el origen exacto y sobrescribe encabezados de proxy antes de reenviar",
  async () => {
    const recibidas = [];
    const destino = crearServidor((solicitud, respuesta) => {
      let cuerpo = "";
      solicitud.on("data", (datos) => {
        cuerpo += datos;
      });
      solicitud.on("end", () => {
        recibidas.push({
          ruta: solicitud.url,
          encabezados: solicitud.headers,
          cuerpo,
        });
        respuesta.writeHead(200, {
          "Content-Type": "application/json",
          "Set-Cookie": "sessionid=prueba; Secure; HttpOnly; SameSite=Lax",
        });
        respuesta.end('{"ok":true}');
      });
    });
    destino.listen(0, "127.0.0.1");
    await esperarEvento(destino, "listening");
    const puertoDestino = destino.address().port;
    let detenido = false;
    const pasarela = crearPasarela({
      obtenerEstado: () => ({
        estado: "listo",
        origen: "https://prueba-chofer.trycloudflare.com",
      }),
      claveControl: "a".repeat(64),
      alDetener: () => {
        detenido = true;
      },
      puertos: { web: puertoDestino, api: puertoDestino },
    });
    pasarela.listen(0, "127.0.0.1");
    await esperarEvento(pasarela, "listening");
    const puerto = pasarela.address().port;
    try {
      afirmar.equal((await consultar(puerto, "/api/v1/usuarios/")).estado, 404);
      afirmar.equal(
        (await consultar(puerto, "/__control-chofer", { metodo: "POST" }))
          .estado,
        404,
      );
      afirmar.equal(detenido, false);
      afirmar.equal(
        (
          await consultar(puerto, "/mis-viajes", {
            encabezados: { Host: "ajeno.trycloudflare.com" },
          })
        ).estado,
        421,
      );
      afirmar.equal(
        (
          await consultar(puerto, "/mis-viajes", {
            encabezados: { "X-Forwarded-Proto": "http" },
          })
        ).estado,
        308,
      );
      afirmar.equal(
        (
          await consultar(puerto, "/api/v1/auth/login/", {
            metodo: "POST",
            encabezados: { "Content-Type": "application/json" },
            cuerpo: "{}",
          })
        ).estado,
        403,
      );
      const respuesta = await consultar(puerto, "/api/v1/auth/login/", {
        metodo: "POST",
        encabezados: {
          Origin: "https://prueba-chofer.trycloudflare.com",
          "Content-Type": "application/json",
          "X-Forwarded-Host": "ajeno",
          "X-Forwarded-For": "inventada",
          "CF-Connecting-IP": "1.2.3.4",
          "X-Middleware-Subrequest": "middleware",
          "X-CSRFToken": "token",
          Cookie: "csrftoken=prueba",
        },
        cuerpo: '{"email":"prueba","password":"sin_registro"}',
      });
      afirmar.equal(respuesta.estado, 200);
      afirmar.match(respuesta.encabezados["set-cookie"][0], /Secure; HttpOnly/);
      afirmar.equal(
        respuesta.encabezados["cache-control"],
        "private, no-store",
      );
      afirmar.equal(recibidas.length, 1);
      afirmar.equal(
        recibidas[0].encabezados.host,
        "prueba-chofer.trycloudflare.com",
      );
      afirmar.equal(recibidas[0].encabezados["x-forwarded-proto"], "https");
      afirmar.equal(recibidas[0].encabezados["x-forwarded-for"], "1.2.3.4");
      afirmar.equal(recibidas[0].encabezados["x-forwarded-host"], undefined);
      afirmar.equal(
        recibidas[0].encabezados["x-middleware-subrequest"],
        undefined,
      );
      afirmar.equal(recibidas[0].encabezados["x-csrftoken"], "token");
      afirmar.equal(JSON.parse(recibidas[0].cuerpo).email, "prueba");
      afirmar.equal((await consultar(puerto, "/signin")).estado, 200);
      afirmar.equal(
        recibidas[1].encabezados.host,
        `localhost:${puertoDestino}`,
      );
      afirmar.equal(recibidas[1].encabezados["x-forwarded-proto"], "http");
    } finally {
      pasarela.closeAllConnections();
      destino.closeAllConnections();
      await Promise.all([
        new Promise((resolver) => pasarela.close(resolver)),
        new Promise((resolver) => destino.close(resolver)),
      ]);
    }
  },
);
