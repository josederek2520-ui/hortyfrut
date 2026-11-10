import { readFileSync as leerArchivo, existsSync as existe } from "node:fs";
import { resolve as resolver, dirname as directorio } from "node:path";
import { fileURLToPath as rutaArchivo } from "node:url";
import { runInNewContext as ejecutar } from "node:vm";
import compilador from "typescript";
const raiz = rutaArchivo(new URL("../../src/", import.meta.url));
export function crearCargadorChofer(dependencias = {}, globales = {}) {
  const memoria = new Map();
  function cargar(nombre) {
    let archivo = resolver(raiz, nombre);
    if (!existe(archivo)) archivo += existe(archivo + ".ts") ? ".ts" : ".tsx";
    if (memoria.has(archivo)) return memoria.get(archivo);
    const exportaciones = {};
    memoria.set(archivo, exportaciones);
    const codigo = compilador.transpileModule(leerArchivo(archivo, "utf8"), {
      compilerOptions: {
        module: compilador.ModuleKind.CommonJS,
        target: compilador.ScriptTarget.ES2022,
        jsx: compilador.JsxEmit.ReactJSX,
      },
    }).outputText;
    ejecutar(codigo, {
      exports: exportaciones,
      require: (ruta) => {
        if (ruta in dependencias) return dependencias[ruta];
        if (ruta.endsWith(".module.css")) return { default: {} };
        if (ruta.startsWith("@/")) return cargar(ruta.slice(2));
        if (ruta.startsWith("."))
          return cargar(resolver(directorio(archivo), ruta));
        throw new Error(`Dependencia no configurada: ${ruta}`);
      },
      URL,
      AbortController,
      AbortSignal,
      setTimeout,
      clearTimeout,
      Date,
      Map,
      Set,
      ...globales,
    });
    return exportaciones;
  }
  return cargar;
}
