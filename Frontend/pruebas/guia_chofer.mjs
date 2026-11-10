import prueba from "node:test";
import afirmar from "node:assert/strict";
import { randomUUID as crearUuid } from "node:crypto";
import { setImmediate as ceder } from "node:timers/promises";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const cargar = crearCargadorChofer();
const { recortarGuia, objetivoGuia, posicionValidaGuia } = cargar(
  "lib/chofer/modulos/recorrido/aplicacion/geometriaGuia",
);
const { GestorGuiaChofer } = cargar(
  "lib/chofer/modulos/recorrido/aplicacion/GestorGuiaChofer",
);
const { ErrorAplicacion } = cargar("lib/chofer/compartido/dominio/Errores");
const base = Date.parse("2026-11-09T13:00:00Z");
const linea = {
  type: "LineString",
  coordinates: [
    [0, 0],
    [0.01, 0],
    [0.02, 0],
  ],
};
const posicion = (x = 0.005, y = 0, tiempo = base, precision = 10) => ({
  id: crearUuid(),
  longitud: x,
  latitud: y,
  precisionM: precision,
  capturadaEn: new Date(tiempo).toISOString(),
  velocidadMS: null,
  rumbo: null,
});
const contexto = (pos = posicion()) => ({
  clave: "usuario1:viaje3:sesion1:plan7:tramo1",
  viaje: 3,
  version: "v1",
  sesion: crearUuid(),
  objetivo: {
    plan: 7,
    tramo: 1,
    destino: {
      tipo: "sucursal",
      parada: 11,
      orden: 1,
      posicion: [0.02, 0],
      color: "#123456",
    },
    geometria: linea,
  },
  posicion: pos,
});
const respuesta = (documento, geometria) => ({
  consulta: documento.clave_operacion,
  estado: "lista",
  sesion: documento.sesion,
  plan: documento.plan,
  tramo: documento.tramo,
  version: documento.version,
  venceEn: new Date(base + 90000).toISOString(),
  geometria,
});
const camino = (documento) => ({
  type: "LineString",
  coordinates: [
    [Number(documento.posicion.longitud), Number(documento.posicion.latitud)],
    [0.02, Number(documento.posicion.latitud)],
    [0.02, 0],
  ],
});

prueba(
  "el recorte avanza por el tramo sin cambiar el plan ni mover la posicion GPS",
  () => {
    const original = JSON.stringify(linea),
      pos = posicion();
    const primera = recortarGuia(linea, [pos.longitud, pos.latitud], 10);
    afirmar.equal(primera.geometria.coordinates[0][0], 0.005);
    const segunda = recortarGuia(linea, [0.01, 0], 10, primera.avance);
    afirmar.ok(segunda.distanciaM < primera.distanciaM);
    afirmar.equal(JSON.stringify(linea), original);
    afirmar.equal(pos.longitud, 0.005);
    afirmar.equal(recortarGuia(linea, [0.005, 0.002], 10), null);
  },
);
prueba("precision y antiguedad de GPS se validan antes de guiar", () => {
  afirmar.equal(posicionValidaGuia(posicion(), base), true);
  afirmar.equal(posicionValidaGuia(posicion(0, 0, base - 31000), base), false);
  afirmar.equal(posicionValidaGuia(posicion(0, 0, base, 101), base), false);
  afirmar.equal(posicionValidaGuia(posicion(Infinity, 0), base), false);
});
prueba(
  "los cruces cercanos conservan la continuidad sin saltar a otra vuelta",
  () => {
    const vuelta = {
      type: "LineString",
      coordinates: [
        [0, 0],
        [0.01, 0],
        [0.01, 0.01],
        [0, 0.01],
        [0, 0.00001],
        [0.01, 0.00001],
      ],
    };
    const recorte = recortarGuia(vuelta, [0.001, 0.00001], 10, 90);
    afirmar.ok(recorte.avance < 200);
  },
);
prueba(
  "el objetivo avanza solo al completar la descarga y termina en el almacen fijado",
  () => {
    const puntos = [
      { tipo: "almacen", orden: 0, posicion: [0, 0] },
      { tipo: "sucursal", orden: 1, parada: 11, posicion: [0.02, 0] },
      { tipo: "sucursal", orden: 2, parada: 12, posicion: [0.03, 0] },
      { tipo: "retorno", orden: 3, posicion: [0, 0] },
    ];
    const ruta = {
      plan: {
        id: 7,
        fijadaEn: "2026-11-09T13:00:00Z",
        puntos,
        tramos: [{ orden: 1, geometria: linea }],
      },
    };
    const paradas = [
      { id: 11, llegadaEn: "2026-11-09", descargadaEn: null },
      { id: 12, descargadaEn: null },
    ];
    afirmar.equal(objetivoGuia(ruta, paradas).tramo, 1);
    paradas[0].descargadaEn = "2026-11-09";
    afirmar.equal(objetivoGuia(ruta, paradas).tramo, 2);
    paradas[1].descargadaEn = "2026-11-09";
    afirmar.equal(objetivoGuia(ruta, paradas).destino.tipo, "retorno");
    afirmar.equal(
      objetivoGuia(
        { ...ruta, plan: { ...ruta.plan, fijadaEn: null } },
        paradas,
      ),
      null,
    );
  },
);
prueba(
  "al seguir el camino se recorta localmente sin consultar OSRM por cada lectura",
  () => {
    let llamadas = 0,
      ahora = base;
    const gestor = new GestorGuiaChofer(
      {
        consultar() {
          llamadas++;
        },
      },
      crearUuid,
      () => ahora,
    );
    const ctx = contexto();
    gestor.actualizar(ctx);
    const primera = gestor.obtenerEstado().distanciaM;
    ahora += 3000;
    gestor.actualizar({ ...ctx, posicion: posicion(0.01, 0, ahora) });
    afirmar.ok(gestor.obtenerEstado().distanciaM < primera);
    afirmar.equal(llamadas, 0);
    afirmar.equal(gestor.obtenerEstado().fase, "recorrido");
  },
);
prueba(
  "dos lecturas desviadas solicitan un camino desde GPS y permiten seguir avanzando",
  async () => {
    let ahora = base;
    const solicitudes = [];
    const gestor = new GestorGuiaChofer(
      {
        async consultar(viaje, documento) {
          solicitudes.push(JSON.stringify(documento));
          return respuesta(documento, camino(documento));
        },
      },
      crearUuid,
      () => ahora,
    );
    const ctx = contexto(posicion(0.005, 0.002, ahora));
    gestor.actualizar(ctx);
    afirmar.equal(solicitudes.length, 0);
    ahora += 3000;
    gestor.actualizar({ ...ctx, posicion: posicion(0.006, 0.002, ahora) });
    await ceder();
    afirmar.equal(solicitudes.length, 1);
    afirmar.equal(gestor.obtenerEstado().fase, "actualizada");
    ahora += 3000;
    gestor.actualizar({ ...ctx, posicion: posicion(0.008, 0.002, ahora) });
    afirmar.equal(solicitudes.length, 1);
    afirmar.equal(gestor.obtenerEstado().geometria.coordinates[0][0], 0.008);
  },
);
prueba("el error de GPS aislado no dispara una nueva ruta", () => {
  let ahora = base,
    llamadas = 0;
  const gestor = new GestorGuiaChofer(
    {
      consultar() {
        llamadas++;
      },
    },
    crearUuid,
    () => ahora,
  );
  const ctx = contexto();
  gestor.actualizar(ctx);
  ahora += 3000;
  gestor.actualizar({ ...ctx, posicion: posicion(0.005, 0.002, ahora) });
  ahora += 3000;
  gestor.actualizar({ ...ctx, posicion: posicion(0.006, 0, ahora) });
  afirmar.equal(llamadas, 0);
});
prueba(
  "una respuesta incierta mantiene UUID y cuerpo exactos aunque cambie la lectura GPS",
  async () => {
    let ahora = base,
      fallar = true;
    const cuerpos = [];
    const gestor = new GestorGuiaChofer(
      {
        async consultar(viaje, documento) {
          cuerpos.push(JSON.stringify(documento));
          if (fallar) {
            fallar = false;
            throw new ErrorAplicacion("conexion", 0);
          }
          return respuesta(documento, camino(documento));
        },
      },
      crearUuid,
      () => ahora,
    );
    const ctx = contexto(posicion(0.005, 0.002, ahora));
    gestor.actualizar(ctx);
    ahora += 3000;
    gestor.actualizar({ ...ctx, posicion: posicion(0.006, 0.002, ahora) });
    await ceder();
    ahora += 30000;
    gestor.actualizar({ ...ctx, posicion: posicion(0.007, 0.002, ahora) });
    await ceder();
    afirmar.equal(cuerpos.length, 2);
    afirmar.equal(cuerpos[0], cuerpos[1]);
    afirmar.equal(gestor.obtenerEstado().fase, "actualizada");
  },
);
prueba(
  "detener o cambiar de cuenta descarta la respuesta tardia sin reactivar la guia",
  async () => {
    let ahora = base,
      resolver,
      senal;
    const gestor = new GestorGuiaChofer(
      {
        consultar(viaje, documento, signal) {
          senal = signal;
          return new Promise((r) => {
            resolver = () => r(respuesta(documento, camino(documento)));
          });
        },
      },
      crearUuid,
      () => ahora,
    );
    const ctx = contexto(posicion(0.005, 0.002, ahora));
    gestor.actualizar(ctx);
    ahora += 3000;
    gestor.actualizar({ ...ctx, posicion: posicion(0.006, 0.002, ahora) });
    gestor.limpiar();
    afirmar.equal(senal.aborted, true);
    resolver();
    await ceder();
    afirmar.equal(gestor.obtenerEstado().fase, "inactiva");
    afirmar.equal(gestor.obtenerEstado().geometria, null);
  },
);
prueba(
  "el destino o sesion nuevos no heredan la espera HTTP anterior",
  async () => {
    let ahora = base;
    const solicitudes = [];
    const gestor = new GestorGuiaChofer(
      {
        async consultar(viaje, documento) {
          solicitudes.push(documento);
          throw new ErrorAplicacion("conexion", 0);
        },
      },
      crearUuid,
      () => ahora,
    );
    const ctx = contexto(posicion(0.005, 0.002, ahora));
    gestor.actualizar(ctx);
    ahora += 3000;
    gestor.actualizar({ ...ctx, posicion: posicion(0.006, 0.002, ahora) });
    await ceder();
    const nuevo = {
      ...ctx,
      clave: "otra-sesion",
      sesion: crearUuid(),
      posicion: posicion(0.006, 0.002, ahora),
    };
    gestor.actualizar(nuevo);
    ahora += 3000;
    gestor.actualizar({ ...nuevo, posicion: posicion(0.007, 0.002, ahora) });
    await ceder();
    afirmar.equal(solicitudes.length, 2);
    afirmar.notEqual(
      solicitudes[0].clave_operacion,
      solicitudes[1].clave_operacion,
    );
  },
);
prueba(
  "una llegada o descarga parcial conserva el camino y renueva la version de consultas",
  async () => {
    let ahora = base;
    const gestor = new GestorGuiaChofer(
      {
        async consultar(viaje, documento) {
          return respuesta(documento, camino(documento));
        },
      },
      crearUuid,
      () => ahora,
    );
    const ctx = contexto(posicion(0.005, 0.002, ahora));
    gestor.actualizar(ctx);
    ahora += 3000;
    const segunda = { ...ctx, posicion: posicion(0.006, 0.002, ahora) };
    gestor.actualizar(segunda);
    await ceder();
    const caminoActual = gestor.obtenerEstado().geometria;
    gestor.actualizar({ ...segunda, version: "v2" });
    afirmar.equal(gestor.obtenerEstado().geometria, caminoActual);
  },
);
prueba("al caducar GPS se retira la guia sin inventar movimiento", () => {
  let ahora = base;
  const gestor = new GestorGuiaChofer(
    { consultar() {} },
    crearUuid,
    () => ahora,
  );
  gestor.actualizar(contexto());
  ahora += 31000;
  gestor.tic();
  afirmar.equal(gestor.obtenerEstado().fase, "inactiva");
});
prueba(
  "el transporte HTTP valida cuenta contextual, plan, destino y geometria",
  async () => {
    const { RepositorioGuiaHttp } = cargar(
      "lib/chofer/modulos/recorrido/datos/RepositorioGuiaHttp",
    );
    const ctx = contexto();
    const doc = {
      clave_operacion: crearUuid(),
      version: "v1",
      sesion: ctx.sesion,
      plan: 7,
      tramo: 1,
      posicion: {},
    };
    let dato = {
      consulta: doc.clave_operacion,
      estado: "lista",
      sesion: doc.sesion,
      plan: 7,
      tramo: 1,
      version_despacho: "v1",
      vence_en: new Date(base + 90000).toISOString(),
      trafico_en_vivo: false,
      geometria: linea,
    };
    const peticiones = [];
    const repo = new RepositorioGuiaHttp({
      async solicitar(ruta, opciones) {
        peticiones.push({ ruta, opciones });
        return dato;
      },
    });
    afirmar.equal(
      (await repo.consultar(3, doc, new AbortController().signal)).geometria,
      linea,
    );
    afirmar.equal(peticiones[0].ruta, "chofer/mis-viajes/3/guia-destino/");
    afirmar.equal(peticiones[0].opciones.metodo, "POST");
    dato = { ...dato, tramo: 2 };
    await afirmar.rejects(() =>
      repo.consultar(3, doc, new AbortController().signal),
    );
  },
);
for (const idioma of ["es", "en"]) {
  const mensajes = JSON.parse(
    leerArchivo(
      new URL("../src/messages/" + idioma + ".json", import.meta.url),
      "utf8",
    ),
  );
  const t = crearTraductor({
      locale: idioma,
      messages: mensajes,
      namespace: "chofer.guia",
    }),
    icono = () => React.createElement("svg");
  const Estado = crearCargadorChofer({
    react: React,
    "react/jsx-runtime": jsx,
    "next-intl": { useLocale: () => idioma, useTranslations: () => t },
    "lucide-react": {
      Navigation: icono,
      LoaderCircle: icono,
      RefreshCw: icono,
    },
  })("components/chofer/EstadoGuiaChofer").default;
  prueba("la guia comunica estado y distancia pendiente en " + idioma, () => {
    const html = representar(
      React.createElement(Estado, {
        estado: {
          clave: "ctx",
          fase: "actualizada",
          tramo: 1,
          geometria: linea,
          distanciaM: 1250,
        },
        alReintentar() {},
      }),
    );
    afirmar.ok(html.includes(t("actualizada")));
    afirmar.ok(html.includes("km"));
    const error = representar(
      React.createElement(Estado, {
        estado: {
          clave: "ctx",
          fase: "sin_guia",
          tramo: 1,
          geometria: null,
          distanciaM: null,
          esperaS: 20,
        },
        alReintentar() {},
      }),
    );
    afirmar.ok(error.includes("disabled"));
    afirmar.ok(error.includes(t("espera", { segundos: 20 })));
  });
}
