import { spawn as iniciarProceso } from "node:child_process";
import {
  readFile as leerArchivo,
  mkdir as crearDirectorio,
  open as abrir,
  unlink as quitar,
} from "node:fs/promises";
import { join as unir } from "node:path";
import { setTimeout as esperar } from "node:timers/promises";
import { raiz, directorioLocal, archivoEstado } from "./configuracion.mjs";
import { consultarEstado } from "./control_local.mjs";

await crearDirectorio(directorioLocal, { recursive: true });
// El chat publico recibe sus avisos desde el mismo servidor local de canales.
await new Promise((resolver, rechazar) => {
  const canal = iniciarProceso(
    process.execPath,
    [unir(raiz, "infraestructura", "supervision", "iniciar_supervision.mjs")],
    { cwd: raiz, windowsHide: true, stdio: "inherit" },
  );
  canal.once("error", rechazar);
  canal.once("exit", (codigo) =>
    codigo === 0
      ? resolver()
      : rechazar(new Error("No se pudo iniciar el canal del chat.")),
  );
});
try {
  const actual = await consultarEstado();
  if (actual.estado === "listo") {
    console.log(`HTTPS del chofer: ${actual.origen}/mis-viajes`);
    console.log(`Chat HTTPS: ${actual.origen}/chat`);
    process.exit(0);
  }
} catch {
  /* Preparar un acceso cuando no hay uno activo. */
}
const archivoCandado = unir(directorioLocal, "arranque.lock");
let candado;
try {
  candado = await abrir(archivoCandado, "wx");
} catch {
  try {
    const previo = JSON.parse(await leerArchivo(archivoCandado, "utf8"));
    let vivo = true;
    try {
      process.kill(previo.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") vivo = false;
    }
    if (!vivo) {
      await quitar(archivoCandado);
      candado = await abrir(archivoCandado, "wx");
    }
  } catch {
    /* Un arranque concurrente conserva su candado. */
  }
  if (!candado) {
    console.error("Ya hay un arranque en curso. Espera a que termine.");
    process.exit(1);
  }
}
try {
  await candado.writeFile(JSON.stringify({ pid: process.pid }));
  const registro = await abrir(unir(directorioLocal, "supervisor.log"), "a");
  const supervisor = iniciarProceso(
    process.execPath,
    [unir(raiz, "infraestructura", "chofer_https", "ejecutar_tunel.mjs")],
    {
      cwd: raiz,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", registro.fd, registro.fd],
    },
  );
  supervisor.unref();
  await registro.close();
  const inicio = Date.now();
  let ultimoPaso = "";
  while (Date.now() - inicio < 300000) {
    await esperar(500);
    let estado;
    try {
      estado = JSON.parse(await leerArchivo(archivoEstado, "utf8"));
    } catch {
      continue;
    }
    if (estado.pidSupervisor !== supervisor.pid) continue;
    if (estado.paso !== ultimoPaso) {
      console.log(estado.paso);
      ultimoPaso = estado.paso;
    }
    if (estado.estado === "error") throw new Error(estado.paso);
    if (estado.estado === "listo") {
      await consultarEstado();
      console.log(`HTTPS del chofer: ${estado.origen}/mis-viajes`);
      console.log(`Chat HTTPS: ${estado.origen}/chat`);
      process.exitCode = 0;
      break;
    }
  }
  if (process.exitCode !== 0)
    throw new Error(
      "No terminó el arranque. Revisa .local/chofer_https/supervisor.log.",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await candado.close();
  await quitar(archivoCandado).catch(() => {});
}
