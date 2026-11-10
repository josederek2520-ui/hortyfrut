/** Prueba HTTP con Next de produccion y cuenta ficticia; no accede a PostgreSQL. */
import { createServer as crearServidor, request as solicitar } from "node:http";
import { spawn as iniciar } from "node:child_process";
import { once as esperarEvento } from "node:events";
import { setTimeout as esperar } from "node:timers/promises";
import { createRequire as crearRequire } from "node:module";
import { fileURLToPath as rutaArchivo } from "node:url";
import afirmar from "node:assert/strict";
import { crearPasarela } from "../infraestructura/chofer_https/pasarela_chofer.mjs";

const require = crearRequire(import.meta.url);
const {
  prepareFlightRouterStateForRequest: prepararArbol,
} = require("../Frontend/node_modules/next/dist/client/flight-data-helpers.js");
const {
  computeCacheBustingSearchParam: calcularHuella,
} = require("../Frontend/node_modules/next/dist/shared/lib/router/utils/cache-busting-search-param.js");
const origen = "https://prueba-chofer.trycloudflare.com";
const cuenta = {
  user: {
    id: 123456,
    is_active: true,
    nombre_completo: "Cuenta ficticia de navegacion",
    first_name: "Prueba",
    last_name: "Navegacion",
    email: "navegacion@example.invalid",
    roles: [],
  },
  acceso_publico: true,
  permisos_chofer: { ver: true, operar: true },
  permisos_entregas: {
    ver: true,
    crear: true,
    editar: true,
    enviar: true,
    confirmar: false,
    ver_todas: false,
    gestionar_todas: false,
  },
};
let consultas = 0,
  servidorWeb,
  pasarela;
const api = crearServidor((solicitud, respuesta) => {
  ++consultas;
  afirmar.equal(solicitud.url, "/api/v1/auth/me/");
  afirmar.equal(solicitud.headers.cookie, "sessionid=cuenta-ficticia");
  respuesta.writeHead(200, { "Content-Type": "application/json" });
  respuesta.end(JSON.stringify(cuenta));
});

async function consultar(puerto, camino, cabeceras = {}) {
  return new Promise((resolver, rechazar) => {
    const peticion = solicitar(
      {
        hostname: "127.0.0.1",
        port: puerto,
        path: camino,
        headers: {
          Host: new URL(origen).host,
          "X-Forwarded-Proto": "https",
          Cookie: "sessionid=cuenta-ficticia",
          ...cabeceras,
        },
        timeout: 8000,
      },
      (respuesta) => {
        let cuerpo = "";
        respuesta.setEncoding("utf8");
        respuesta.on("data", (parte) => {
          cuerpo += parte;
        });
        respuesta.on("end", () =>
          resolver({
            estado: respuesta.statusCode,
            cabeceras: respuesta.headers,
            cuerpo,
          }),
        );
        respuesta.on("error", rechazar);
      },
    );
    peticion.on("timeout", () =>
      peticion.destroy(new Error("La navegacion tardo mas de ocho segundos.")),
    );
    peticion.on("error", rechazar);
    peticion.end();
  });
}

try {
  api.listen(0, "127.0.0.1");
  await esperarEvento(api, "listening");
  const reserva = crearServidor();
  reserva.listen(0, "localhost");
  await esperarEvento(reserva, "listening");
  const puertoWeb = reserva.address().port;
  await new Promise((resolver) => reserva.close(resolver));
  let errores = "";
  servidorWeb = iniciar(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "localhost",
      "-p",
      String(puertoWeb),
    ],
    {
      cwd: rutaArchivo(new URL("../Frontend/", import.meta.url)),
      windowsHide: true,
      env: {
        ...process.env,
        MODO_CHOFER_HTTPS: "1",
        NODE_ENV: "production",
        DJANGO_API_URL: `http://127.0.0.1:${api.address().port}`,
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  servidorWeb.stderr.on("data", (datos) => {
    errores = (errores + datos).slice(-2000);
  });
  let listo = false;
  for (let intento = 0; intento < 50; intento++) {
    if (servidorWeb.exitCode !== null) throw new Error(errores);
    try {
      const respuesta = await fetch(
        `http://localhost:${puertoWeb}/sonidos/notificacion-chat.mp3`,
        { signal: AbortSignal.timeout(1000) },
      );
      await respuesta.arrayBuffer();
      if (respuesta.ok) {
        listo = true;
        break;
      }
    } catch {
      /* Esperar el proceso de prueba propio. */
    }
    await esperar(200);
  }
  afirmar.ok(listo, "Next debe iniciar con la compilacion publica existente.");
  pasarela = crearPasarela({
    obtenerEstado: () => ({ estado: "listo", origen }),
    claveControl: "a".repeat(64),
    alDetener: () => {},
    puertos: { api: api.address().port, web: puertoWeb },
  });
  pasarela.listen(0, "127.0.0.1");
  await esperarEvento(pasarela, "listening");
  const comprobadas = [];
  const arbol = prepararArbol([
    "",
    {
      children: [
        ["locale", "es", "d"],
        {
          children: [
            "(chofer)",
            { children: ["mis-viajes", { children: ["__PAGE__", {}] }] },
          ],
        },
      ],
    },
  ]);
  const huella = await calcularHuella(
    undefined,
    undefined,
    arbol,
    "/mis-viajes",
  );
  for (const ruta of [
    "/mis-viajes",
    "/chat",
    "/mis-viajes/5",
    "/entregas",
    "/entregas/5/7",
  ]) {
    const documento = await consultar(pasarela.address().port, ruta);
    afirmar.equal(documento.estado, 200, ruta);
    afirmar.match(documento.cabeceras["content-type"], /text\/html/);
    afirmar.ok(
      !documento.cuerpo.includes("NEXT_REDIRECT"),
      "La cuenta ficticia debe conservar su acceso.",
    );
    const navegacion = await consultar(
      pasarela.address().port,
      ruta + "?_rsc=" + huella,
      {
        rsc: "1",
        "next-url": "/mis-viajes",
        "next-router-state-tree": arbol,
      },
    );
    afirmar.equal(
      navegacion.estado,
      200,
      "La navegacion no debe redirigir: " + ruta,
    );
    afirmar.equal(navegacion.cabeceras["content-type"], "text/x-component");
    afirmar.ok(
      navegacion.cuerpo.includes('"f":'),
      "Debe devolver el arbol de destino.",
    );
    afirmar.ok(
      !navegacion.cuerpo.includes("NEXT_REDIRECT"),
      "No debe entrar en un ciclo de navegacion.",
    );
    afirmar.equal(navegacion.cabeceras.location, undefined);
    afirmar.equal(navegacion.cabeceras["cache-control"], "private, no-store");
    comprobadas.push(ruta);
  }
  console.log(
    JSON.stringify({
      produccion: true,
      paginas: comprobadas,
      solicitudesSesion: consultas,
      navegacionSinRedirecciones: true,
      cuentaFicticia: true,
    }),
  );
} finally {
  if (pasarela) {
    pasarela.closeAllConnections();
    await new Promise((resolver) => pasarela.close(resolver));
  }
  api.closeAllConnections();
  await new Promise((resolver) => api.close(resolver));
  if (servidorWeb && servidorWeb.exitCode === null) {
    servidorWeb.kill();
    await esperarEvento(servidorWeb, "exit");
  }
}
