import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
const requerir = createRequire(import.meta.url);
const compilador = requerir("typescript");
const raiz = fileURLToPath(new URL("../src/", import.meta.url));
export function crearCargador(dependencias = {}) {
  const memoria = new Map();
  function cargar(nombre) {
    let archivo = resolve(raiz, nombre);
    if (!existsSync(archivo))
      archivo += existsSync(archivo + ".ts") ? ".ts" : ".tsx";
    if (memoria.has(archivo)) return memoria.get(archivo);
    const exportaciones = {};
    memoria.set(archivo, exportaciones);
    const codigo = compilador.transpileModule(readFileSync(archivo, "utf8"), {
      compilerOptions: {
        module: compilador.ModuleKind.CommonJS,
        target: compilador.ScriptTarget.ES2022,
        jsx: compilador.JsxEmit.ReactJSX,
      },
    }).outputText;
    runInNewContext(codigo, {
      exports: exportaciones,
      require: (ruta) => {
        if (ruta in dependencias) return dependencias[ruta];
        if (ruta.startsWith("@/")) return cargar(ruta.slice(2));
        if (ruta.startsWith("."))
          return cargar(resolve(dirname(archivo), ruta));
        throw Error(`Dependencia no configurada: ${ruta}`);
      },
      URL,
      AbortController,
      setTimeout,
      clearTimeout,
      fetch,
      Date,
      Map,
      Set,
      process: { env: {} },
      __DEV__: true,
    });
    return exportaciones;
  }
  return cargar;
}
