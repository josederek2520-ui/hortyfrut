import { spawn as iniciarProceso } from "node:child_process";
import {
  mkdir as crearDirectorio,
  open as abrir,
  writeFile as escribirArchivo,
} from "node:fs/promises";
import {
  randomBytes as generarBytes,
  randomUUID as generarUuid,
} from "node:crypto";
import { join as unir } from "node:path";
import { createServer as crearComprobador } from "node:net";
import { setTimeout as esperar } from "node:timers/promises";
import {
  raiz,
  carpeta,
  archivoEstado,
  consultarEstado,
} from "./control_local.mjs";
try {
  await consultarEstado();
  console.log("Supervisión local disponible en el puerto 8002.");
  process.exit(0);
} catch {
  /* Iniciar si no está activo. */
}
const comprobador = crearComprobador();
try {
  await new Promise((resolver, rechazar) => {
    comprobador.once("error", rechazar);
    comprobador.listen(8002, "127.0.0.1", resolver);
  });
  await new Promise((resolver) => comprobador.close(resolver));
} catch {
  console.error(
    "El puerto 8002 está ocupado por otro proceso; no se modificó.",
  );
  process.exit(1);
}
await crearDirectorio(carpeta, { recursive: true });
const registro = await abrir(unir(carpeta, "servidor.log"), "a");
const clave = generarBytes(32).toString("hex"),
  instancia = generarUuid();
const proceso = iniciarProceso(
  unir(raiz, "Backend", ".venv", "Scripts", "python.exe"),
  ["-m", "daphne", "-b", "127.0.0.1", "-p", "8002", "config.asgi:application"],
  {
    cwd: unir(raiz, "Backend"),
    windowsHide: true,
    stdio: ["ignore", registro.fd, registro.fd],
    env: {
      ...process.env,
      DJANGO_SETTINGS_MODULE: "config.settings",
      SUPERVISION_CONTROL: clave,
      SUPERVISION_INSTANCIA: instancia,
      PYTHONUNBUFFERED: "1",
    },
  },
);
// Conservar el supervisor mientras viva el lanzador Python de Windows.
await registro.close();
const errorInicio = new Promise((_, rechazar) =>
  proceso.once("error", rechazar),
);
try {
  await escribirArchivo(
    archivoEstado,
    JSON.stringify({ pid: proceso.pid, clave, instancia }, null, 2),
  );
  await Promise.race([
    errorInicio,
    (async () => {
      const inicio = Date.now();
      while (Date.now() - inicio < 30000) {
        try {
          const actual = await consultarEstado(true);
          await escribirArchivo(archivoEstado, JSON.stringify(actual, null, 2));
          console.log(
            "Supervisión local lista. El administrador recibe los avisos por /ws/seguimiento/.",
          );
          return;
        } catch {
          await esperar(500);
        }
      }
      throw new Error(
        "No arrancó el servidor. Revisa .local/supervision/servidor.log.",
      );
    })(),
  ]);
  // Mantener un ciclo de vida propio, incluso cuando termina el lanzador del
  // entorno virtual de Windows. Solo se vigila esta instancia autenticada.
  let comprobando = false,
    fallos = 0;
  const vigilancia = setInterval(async () => {
    if (comprobando) return;
    comprobando = true;
    try {
      const actual = await consultarEstado();
      if (actual.instancia !== instancia) {
        clearInterval(vigilancia);
        proceso.kill();
      }
      fallos = 0;
    } catch {
      if (++fallos >= 2) {
        clearInterval(vigilancia);
        proceso.kill();
      }
    } finally {
      comprobando = false;
    }
  }, 5000);
} catch (error) {
  proceso.kill();
  console.error(error.message);
  process.exitCode = 1;
}
