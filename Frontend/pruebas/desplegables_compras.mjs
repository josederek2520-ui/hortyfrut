import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { dirname as nombreCarpeta, join as unirRuta } from "node:path";
import { fileURLToPath as rutaDesdeUrl } from "node:url";
import { runInNewContext as ejecutarContexto } from "node:vm";
import compilador from "typescript";

const directorio = nombreCarpeta(rutaDesdeUrl(import.meta.url));
function cargar(ruta) {
  const fuente = leerArchivo(unirRuta(directorio, "../src", ruta), "utf8");
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(fuente, {
      compilerOptions: {
        module: compilador.ModuleKind.CommonJS,
        target: compilador.ScriptTarget.ES2020,
      },
    }).outputText,
    { exports: exportaciones },
  );
  return exportaciones;
}
const { posicionDesplegable } = cargar(
  "components/compras/posicionDesplegable.ts",
);
const { mostrarBolivianos } = cargar("lib/moneda.ts");
const medidas = (cambios = {}) => ({
  ancla: { top: 100, bottom: 144, left: 400, right: 600, width: 200 },
  anchoVentana: 1200,
  altoVentana: 800,
  inicioVentana: 0,
  superiorVentana: 0,
  anchoPreferido: 336,
  altoPanel: 400,
  anchoDocumento: 1200,
  derechaIzquierda: false,
  ...cambios,
});
prueba("el desplegable permanece junto al campo cuando cabe debajo", () => {
  const posicion = posicionDesplegable(medidas());
  afirmar.equal(posicion.superior, 152);
  afirmar.equal(posicion.inicio, 400);
  afirmar.equal(posicion.ancho, 336);
});
prueba("las filas inferiores abren el panel hacia arriba", () => {
  const posicion = posicionDesplegable(
    medidas({
      ancla: { top: 700, bottom: 744, left: 900, right: 1100, width: 200 },
    }),
  );
  afirmar.equal(posicion.superior, 292);
  afirmar.equal(posicion.inicio, 856);
  afirmar.equal(posicion.altoMaximo, 684);
});
prueba("el ancho y el alto se ajustan en móvil con teclado visible", () => {
  const posicion = posicionDesplegable(
    medidas({
      ancla: { top: 110, bottom: 154, left: 20, right: 300, width: 280 },
      anchoVentana: 320,
      altoVentana: 360,
      anchoDocumento: 320,
    }),
  );
  afirmar.equal(posicion.ancho, 304);
  afirmar.equal(posicion.inicio, 8);
  afirmar.ok(posicion.superior >= 8);
  afirmar.ok(posicion.superior + Math.min(400, posicion.altoMaximo) <= 352);
});
prueba("el panel respeta el viewport desplazado y la dirección RTL", () => {
  const posicion = posicionDesplegable(
    medidas({
      derechaIzquierda: true,
      inicioVentana: 100,
      superiorVentana: 50,
      anchoVentana: 800,
      altoVentana: 500,
    }),
  );
  afirmar.equal(posicion.inicio, 600);
  afirmar.ok(posicion.superior >= 58);
  afirmar.ok(posicion.superior + Math.min(400, posicion.altoMaximo) <= 542);
});
prueba(
  "los importes muestran Bs en todos los idiomas habilitados y mantienen decimales",
  () => {
    for (const idioma of ["es", "en"]) {
      for (const valor of ["0", "30.00", "1234.56", "999999999999.99"]) {
        const importe = mostrarBolivianos(valor, idioma);
        afirmar.match(importe, /Bs/);
        afirmar.doesNotMatch(importe, /BOB/);
      }
    }
    afirmar.match(mostrarBolivianos("1234.56", "es"), /1234,56|1[.\s]234,56/);
    afirmar.match(mostrarBolivianos("1234.56", "en"), /1,234\.56/);
  },
);
