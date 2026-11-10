import { readFile as leerArchivo } from "node:fs/promises";
import { fileURLToPath as rutaArchivo } from "node:url";
import { join as unir } from "node:path";
export const raiz = rutaArchivo(new URL("../../", import.meta.url));
export const carpeta = unir(raiz, ".local", "supervision");
export const archivoEstado = unir(carpeta, "estado.json");
export async function consultarEstado(arranque = false) {
  const estado = JSON.parse(await leerArchivo(archivoEstado, "utf8"));
  if (!Number.isInteger(estado.pid) || !/^[a-f0-9]{64}$/.test(estado.clave))
    throw new Error("Estado local no válido.");
  const respuesta = await fetch("http://127.0.0.1:8002/__supervision/control", {
    headers: { "X-Control-Supervision": estado.clave },
    signal: AbortSignal.timeout(2000),
  });
  if (!respuesta.ok) throw new Error("La supervisión no está disponible.");
  const datos = await respuesta.json();
  if (
    (!arranque && datos.pid !== estado.pid) ||
    !Number.isInteger(datos.pid) ||
    datos.instancia !== estado.instancia ||
    datos.servicio !== "hortyfru_supervision"
  )
    throw new Error("El proceso no corresponde a este servicio.");
  return { ...estado, pid: datos.pid };
}
