import prueba from "node:test";
import afirmar from "node:assert/strict";
import {
  mkdtempSync as crearTemporal,
  writeFileSync as escribirArchivo,
  unlinkSync as eliminarArchivo,
  rmdirSync as eliminarCarpeta,
} from "node:fs";
import { tmpdir as directorioTemporal } from "node:os";
import { join as unir } from "node:path";
import {
  detectarProblemasTexto,
  validarTraducciones,
} from "../herramientas/validarTraducciones.mjs";

function conArchivo(contexto, contenido) {
  const carpeta = crearTemporal(
    unir(directorioTemporal(), "hortyfru-traducciones-"),
  );
  const archivo = unir(carpeta, "es.json");
  escribirArchivo(archivo, contenido);
  contexto.after(() => {
    eliminarArchivo(archivo);
    eliminarCarpeta(carpeta);
  });
  return carpeta;
}

prueba(
  "todas las traducciones conservan UTF-8 y no contienen palabras dañadas",
  () => {
    afirmar.ok(validarTraducciones() > 0);
  },
);

prueba(
  "el tooltip de Pedidos conserva el acento de Consultar recepción",
  async () => {
    const { readFileSync: leerArchivo } = await import("node:fs");
    const mensajes = JSON.parse(
      leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
    );
    afirmar.equal(
      mensajes.pedidos.consultarRecepcion,
      "Consultar recepci\u00f3n",
    );
  },
);

prueba(
  "se detectan acentos sustituidos, texto recodificado y caracteres perdidos",
  () => {
    for (const texto of [
      "Consultar recepci?n",
      "Encargado de recepci?n",
      "Solicitar gu?a",
      "Recepci\u00c3\u00b3n",
      "Cajillas\u00c2\u00a0",
      "Texto\ufffd",
      "Cargando\u00e2\u20ac\u00a6",
    ]) {
      afirmar.ok(detectarProblemasTexto(texto).length > 0, texto);
    }
  },
);

prueba(
  "las preguntas y URLs válidas conservan sus signos de interrogación",
  () => {
    for (const texto of [
      "\u00bfConfirmar recepci\u00f3n?",
      "\u00bfQu\u00e9 deseas consultar?",
      "Consultar recepci\u00f3n",
      "View receipt",
      "https://example.invalid/pedidos?pagina=2",
    ]) {
      afirmar.deepEqual(detectarProblemasTexto(texto), []);
    }
  },
);

prueba(
  "se rechazan bytes que no sean UTF-8 en lugar de sustituirlos silenciosamente",
  (contexto) => {
    const carpeta = conArchivo(contexto, Buffer.from([0xc3, 0x28]));
    afirmar.throws(() => validarTraducciones(carpeta), /UTF-8/);
  },
);

prueba(
  "la validación señala el archivo y la clave de una traducción dañada",
  (contexto) => {
    const carpeta = conArchivo(
      contexto,
      JSON.stringify({
        pedidos: { consultarRecepcion: "Consultar recepci?n" },
      }),
    );
    afirmar.throws(
      () => validarTraducciones(carpeta),
      /es\.json\.pedidos\.consultarRecepcion/,
    );
  },
);
