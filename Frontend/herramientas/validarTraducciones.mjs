import {
  readFileSync as leerArchivo,
  readdirSync as listarArchivos,
} from "node:fs";
import { resolve as resolver, join as unir } from "node:path";
import {
  fileURLToPath as rutaArchivo,
  pathToFileURL as urlArchivo,
} from "node:url";

export function detectarProblemasTexto(texto) {
  const problemas = [];
  if (texto.includes("\uFFFD"))
    problemas.push("carácter de sustitución Unicode");
  if (
    /[\u00C3\u00C2][\u0080-\u00BF]|\u00E2[\u0080-\u009F\u20AC]/u.test(texto)
  ) {
    problemas.push("secuencia de texto recodificada incorrectamente");
  }
  // Los signos de una URL son parámetros válidos, no letras perdidas.
  const visible = texto.replace(/\bhttps?:\/\/[^\s<>"']+/giu, "");
  if (/\p{L}\?+\p{L}/u.test(visible))
    problemas.push("signo ? dentro de una palabra");
  return problemas;
}

function recorrerTextos(valor, clave, errores) {
  if (typeof valor === "string") {
    for (const problema of detectarProblemasTexto(valor))
      errores.push(`${clave}: ${problema}`);
  } else if (Array.isArray(valor)) {
    valor.forEach((contenido, indice) =>
      recorrerTextos(contenido, `${clave}[${indice}]`, errores),
    );
  } else if (valor && typeof valor === "object") {
    for (const [nombre, contenido] of Object.entries(valor)) {
      recorrerTextos(contenido, clave ? `${clave}.${nombre}` : nombre, errores);
    }
  }
}

export function validarTraducciones(
  directorio = rutaArchivo(new URL("../src/messages/", import.meta.url)),
) {
  const archivos = listarArchivos(directorio)
    .filter((nombre) => nombre.endsWith(".json"))
    .sort();
  if (!archivos.length)
    throw new Error("No hay archivos de traducciones para comprobar.");
  const errores = [];
  for (const nombre of archivos) {
    let datos;
    try {
      const texto = new TextDecoder("utf-8", { fatal: true }).decode(
        leerArchivo(unir(directorio, nombre)),
      );
      datos = JSON.parse(texto);
    } catch (error) {
      errores.push(
        `${nombre}: archivo JSON o UTF-8 inválido (${error.message})`,
      );
      continue;
    }
    recorrerTextos(datos, nombre, errores);
  }
  if (errores.length) {
    throw new Error(
      "Corrige las traducciones y guarda los archivos en UTF-8:\n" +
        errores.join("\n"),
    );
  }
  return archivos.length;
}

if (
  process.argv[1] &&
  urlArchivo(resolver(process.argv[1])).href === import.meta.url
) {
  try {
    const cantidad = validarTraducciones();
    process.stdout.write(
      `Traducciones UTF-8 correctas: ${cantidad} archivos.\n`,
    );
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
