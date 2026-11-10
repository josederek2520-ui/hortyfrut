import { readFile as leerArchivo } from "node:fs/promises";
import { archivoEstado } from "./configuracion.mjs";
export async function consultarEstado() {
  const estado = JSON.parse(await leerArchivo(archivoEstado, "utf8"));
  if (
    !/^[a-f0-9]{64}$/.test(estado.claveControl) ||
    !Number.isInteger(estado.puertos?.pasarela)
  )
    throw new Error("El estado local no es válido.");
  const respuesta = await fetch(
    `http://127.0.0.1:${estado.puertos.pasarela}/__control-chofer`,
    {
      headers: { "X-Control-Chofer": estado.claveControl },
      signal: AbortSignal.timeout(2000),
    },
  );
  if (!respuesta.ok) throw new Error("El acceso HTTPS no está en ejecución.");
  const control = (await respuesta.json()).detail;
  if (control.pid !== estado.pidSupervisor)
    throw new Error("El proceso de control no corresponde a este acceso.");
  return { ...estado, ...control };
}
