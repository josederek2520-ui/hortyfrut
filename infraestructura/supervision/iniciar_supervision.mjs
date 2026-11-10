import { spawn as iniciarProceso } from "node:child_process";
import { mkdir as crearDirectorio, open as abrir } from "node:fs/promises";
import { join as unir } from "node:path";
import { setTimeout as esperar } from "node:timers/promises";
import { raiz, carpeta, consultarEstado } from "./control_local.mjs";
try {
  await consultarEstado();
  console.log("Supervisión local disponible en el puerto 8002.");
  process.exit(0);
} catch {
  /* Iniciar si hace falta. */
}
await crearDirectorio(carpeta, { recursive: true });
const registro = await abrir(unir(carpeta, "supervisor.log"), "a");
if (process.platform === "win32") {
  const literal = (valor) => "'" + valor.replaceAll("'", "''") + "'";
  const instante = Date.now();
  const salida = unir(carpeta, `supervisor-${instante}.log`),
    errores = unir(carpeta, `supervisor-error-${instante}.log`);
  await registro.write(`Arranque Windows: ${salida}\n`);
  await registro.close();
  const orden = `Start-Process -FilePath ${literal(process.execPath)} -ArgumentList ${literal('"' + unir(raiz, "infraestructura", "supervision", "ejecutar_supervision.mjs") + '"')} -WorkingDirectory ${literal(raiz)} -WindowStyle Hidden -RedirectStandardOutput ${literal(salida)} -RedirectStandardError ${literal(errores)}`;
  await new Promise((resolver, rechazar) => {
    const lanzador = iniciarProceso(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", orden],
      { windowsHide: true, stdio: "ignore" },
    );
    lanzador.once("error", rechazar);
    lanzador.once("exit", (codigo) =>
      codigo === 0
        ? resolver()
        : rechazar(
            new Error("No se pudo iniciar el servicio oculto de canales."),
          ),
    );
  });
} else {
  const proceso = iniciarProceso(
    process.execPath,
    [unir(raiz, "infraestructura", "supervision", "ejecutar_supervision.mjs")],
    {
      cwd: raiz,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", registro.fd, registro.fd],
    },
  );
  proceso.unref();
  await registro.close();
}
const inicio = Date.now();
while (Date.now() - inicio < 35000) {
  try {
    await consultarEstado();
    console.log("Supervisión local lista para el administrador.");
    process.exit(0);
  } catch {
    await esperar(500);
  }
}
console.error(
  "No arrancó la supervisión. Revisa .local/supervision/supervisor.log.",
);
process.exitCode = 1;
