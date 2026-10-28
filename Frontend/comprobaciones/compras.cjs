/* eslint @typescript-eslint/no-require-imports: "off" -- Este archivo se ejecuta como CommonJS con Node. */
const verificar = require("node:assert/strict");
const archivos = require("node:fs");
const rutas = require("node:path");
const maquina = require("node:vm");
const compilador = require("typescript");

const fuente = archivos.readFileSync(
  rutas.join(__dirname, "../src/components/compras/calculos.ts"),
  "utf8",
);
const compilado = compilador.transpileModule(fuente, {
  compilerOptions: {
    module: compilador.ModuleKind.CommonJS,
    target: compilador.ScriptTarget.ES2020,
  },
}).outputText;
const fuenteMoneda = archivos.readFileSync(
  rutas.join(__dirname, "../src/lib/moneda.ts"),
  "utf8",
);
const contextoMoneda = { exports: {}, Intl, Number };
maquina.runInNewContext(
  compilador.transpileModule(fuenteMoneda, {
    compilerOptions: {
      module: compilador.ModuleKind.CommonJS,
      target: compilador.ScriptTarget.ES2020,
    },
  }).outputText,
  contextoMoneda,
);
const contexto = {
  exports: {},
  BigInt,
  Intl,
  Number,
  require: (nombre) => {
    if (nombre === "@/lib/moneda") return contextoMoneda.exports;
    throw new Error(`Dependencia inesperada: ${nombre}`);
  },
};
maquina.runInNewContext(compilado, contexto);
const { subtotalCentavos, totalCentavos, mostrarFecha } = contexto.exports;

verificar.equal(subtotalCentavos("10", "40"), BigInt(40000));
verificar.equal(subtotalCentavos("0.005", "1.00"), BigInt(1));
verificar.equal(subtotalCentavos("0,005", "1,00"), BigInt(1));
verificar.equal(subtotalCentavos("12.345", "1.21"), BigInt(1494));
verificar.equal(
  totalCentavos([
    { cantidad: "0.005", precioUnitario: "1.00" },
    { cantidad: "0.005", precioUnitario: "1.00" },
  ]),
  BigInt(2),
);
verificar.equal(subtotalCentavos("", ""), BigInt(0));
verificar.equal(subtotalCentavos("-1", "40"), null);
verificar.equal(subtotalCentavos("1.0001", "40"), null);
verificar.equal(subtotalCentavos("1", "0.001"), null);
verificar.equal(subtotalCentavos("999999999.999", "9999999999.99"), null);
verificar.equal(
  totalCentavos([
    { cantidad: "100", precioUnitario: "9999999999.99" },
    { cantidad: "100", precioUnitario: "9999999999.99" },
  ]),
  null,
);
verificar.match(mostrarFecha("2026-10-26", "es"), /26/);
console.log(
  "12 comprobaciones correctas: decimales, redondeo por linea, limites e interpretacion de fecha.",
);
