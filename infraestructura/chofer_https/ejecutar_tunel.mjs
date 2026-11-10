import { spawn as iniciarProceso } from "node:child_process";
import {
  createHash as crearHuella,
  randomBytes as generarBytes,
} from "node:crypto";
import {
  readFile as leerArchivo,
  writeFile as escribirArchivo,
  mkdir as crearDirectorio,
  rename as renombrar,
  open as abrir,
} from "node:fs/promises";
import { createWriteStream as crearSalida } from "node:fs";
import { join as unir } from "node:path";
import { createServer as crearComprobador } from "node:net";
import { setTimeout as esperar } from "node:timers/promises";
import { crearPasarela } from "./pasarela_chofer.mjs";
import {
  raiz,
  directorioLocal,
  archivoEstado,
  origenBinario,
  huellaCloudflared,
  puertos,
  validarOrigen,
} from "./configuracion.mjs";

let estado = {
  estado: "preparando",
  paso: "Preparando acceso HTTPS",
  origen: null,
  claveControl: generarBytes(32).toString("hex"),
  pidSupervisor: process.pid,
  puertos,
  procesos: [],
};
const procesos = new Set();
let pasarela,
  cerrando = false;
async function guardar(cambios = {}) {
  estado = { ...estado, ...cambios };
  await escribirArchivo(
    archivoEstado + ".tmp",
    JSON.stringify(estado, null, 2),
  );
  await renombrar(archivoEstado + ".tmp", archivoEstado);
}
function lanzar(nombre, ejecutable, argumentos, opciones = {}) {
  const registro = crearSalida(unir(directorioLocal, nombre + ".log"), {
    flags: "a",
  });
  const proceso = iniciarProceso(ejecutable, argumentos, {
    cwd: raiz,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...opciones,
  });
  procesos.add(proceso);
  proceso.stdout.on("data", (datos) => registro.write(datos));
  proceso.stderr.on("data", (datos) => registro.write(datos));
  proceso.on("error", (error) => registro.write(String(error)));
  proceso.on("close", () => {
    registro.end();
    procesos.delete(proceso);
  });
  estado.procesos.push({ nombre, pid: proceso.pid });
  return proceso;
}
async function comprobarPuerto(puerto) {
  const comprobador = crearComprobador();
  await new Promise((resolver, rechazar) => {
    comprobador.once("error", rechazar);
    comprobador.listen(puerto, "127.0.0.1", resolver);
  });
  await new Promise((resolver) => comprobador.close(resolver));
}
async function esperarHttp(direccion, proceso, limite = 60000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (proceso.exitCode !== null || proceso.signalCode)
      throw new Error(
        "Un servicio terminó antes de estar disponible. Revisa sus registros locales.",
      );
    try {
      const respuesta = await fetch(direccion, {
        signal: AbortSignal.timeout(3000),
        redirect: "manual",
      });
      await respuesta.arrayBuffer();
      if (respuesta.status === 200) return;
    } catch {
      /* Esperar al arranque. */
    }
    await esperar(500);
  }
  throw new Error("Un servicio no respondió dentro del tiempo de arranque.");
}
async function prepararBinario() {
  if (process.platform !== "win32" || process.arch !== "x64")
    throw new Error(
      "Este lanzador corresponde al equipo Windows x64 del proyecto.",
    );
  const carpeta = unir(directorioLocal, "bin"),
    binario = unir(carpeta, "cloudflared.exe");
  await crearDirectorio(carpeta, { recursive: true });
  let contenido;
  try {
    contenido = await leerArchivo(binario);
  } catch {
    const respuesta = await fetch(origenBinario, {
      signal: AbortSignal.timeout(180000),
    });
    if (!respuesta.ok)
      throw new Error(
        "No se pudo descargar cloudflared desde el lanzamiento oficial.",
      );
    contenido = Buffer.from(await respuesta.arrayBuffer());
    if (
      crearHuella("sha256").update(contenido).digest("hex") !==
      huellaCloudflared
    )
      throw new Error(
        "La descarga no coincide con la huella oficial de Cloudflare.",
      );
    await escribirArchivo(binario, contenido);
  }
  if (
    crearHuella("sha256").update(contenido).digest("hex") !== huellaCloudflared
  )
    throw new Error(
      "El binario local de Cloudflare no supera la comprobación de integridad.",
    );
  return binario;
}
async function detener(error) {
  if (cerrando) return;
  cerrando = true;
  for (const proceso of procesos) if (proceso.exitCode === null) proceso.kill();
  await guardar({
    estado: error ? "error" : "detenido",
    paso: error ? String(error.message).slice(0, 300) : "Acceso HTTPS detenido",
  });
  if (pasarela) {
    pasarela.close();
    pasarela.closeAllConnections();
  }
  setTimeout(() => process.exit(error ? 1 : 0), 500).unref();
}
process.on("SIGTERM", () => {
  void detener();
});
process.on("SIGINT", () => {
  void detener();
});
process.on("uncaughtException", (error) => {
  void detener(error);
});
process.on("unhandledRejection", (error) => {
  void detener(error instanceof Error ? error : new Error(String(error)));
});

try {
  await crearDirectorio(directorioLocal, { recursive: true });
  for (const puerto of Object.values(puertos)) await comprobarPuerto(puerto);
  await guardar();
  const binario = await prepararBinario();
  pasarela = crearPasarela({
    obtenerEstado: () => estado,
    claveControl: estado.claveControl,
    alDetener: () => {
      void detener();
    },
    puertos,
  });
  await new Promise((resolver, rechazar) => {
    pasarela.once("error", rechazar);
    pasarela.listen(puertos.pasarela, "127.0.0.1", resolver);
  });
  await guardar({ paso: "Solicitando dirección temporal a Cloudflare" });
  const tunel = lanzar("cloudflare", binario, [
    "tunnel",
    "--no-autoupdate",
    "--url",
    `http://127.0.0.1:${puertos.pasarela}`,
    "--protocol",
    "http2",
  ]);
  let conectado = false;
  const origen = await new Promise((resolver, rechazar) => {
    const temporizador = setTimeout(
      () =>
        rechazar(
          new Error(
            "Cloudflare no entregó una dirección. Revisa cloudflare.log.",
          ),
        ),
      120000,
    );
    const analizar = (datos) => {
      const texto = datos.toString();
      if (texto.includes("Registered tunnel connection")) conectado = true;
      const coincidencia = texto.match(
        /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com/,
      );
      if (coincidencia && validarOrigen(coincidencia[0])) {
        clearTimeout(temporizador);
        resolver(coincidencia[0]);
      }
    };
    tunel.stdout.on("data", analizar);
    tunel.stderr.on("data", analizar);
    tunel.once("error", rechazar);
    tunel.once("exit", () => {
      clearTimeout(temporizador);
      rechazar(new Error("Cloudflare terminó antes de abrir el túnel."));
    });
  });
  const observarConexion = (datos) => {
    if (datos.toString().includes("Registered tunnel connection"))
      conectado = true;
  };
  tunel.stdout.on("data", observarConexion);
  tunel.stderr.on("data", observarConexion);
  await guardar({ origen, paso: "Iniciando API aislada del chofer" });
  const entornoApi = {
    ...process.env,
    ORIGEN_HTTPS_CHOFER: origen,
    PYTHONUNBUFFERED: "1",
  };
  const api = lanzar(
    "api",
    unir(raiz, "Backend", ".venv", "Scripts", "python.exe"),
    [
      "manage.py",
      "runserver",
      `127.0.0.1:${puertos.api}`,
      "--noreload",
      "--settings=config.chofer_https",
    ],
    { cwd: unir(raiz, "Backend"), env: entornoApi },
  );
  await esperarHttp(`http://127.0.0.1:${puertos.api}/api/v1/auth/csrf/`, api);
  await guardar({ paso: "Compilando la web del chofer" });
  const entornoWeb = {
    ...process.env,
    MODO_CHOFER_HTTPS: "1",
    DJANGO_API_URL: `http://127.0.0.1:${puertos.api}`,
    NODE_ENV: "production",
  };
  const cliNext = unir(
    raiz,
    "Frontend",
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const compilacion = lanzar(
    "compilacion",
    process.execPath,
    [cliNext, "build"],
    { cwd: unir(raiz, "Frontend"), env: entornoWeb },
  );
  await new Promise((resolver, rechazar) => {
    compilacion.once("error", rechazar);
    compilacion.once("exit", (codigo) =>
      codigo === 0
        ? resolver()
        : rechazar(new Error("Falló la compilación. Revisa compilacion.log.")),
    );
  });
  await guardar({ paso: "Iniciando web de producción para el chofer" });
  const web = lanzar(
    "web",
    process.execPath,
    [
      cliNext,
      "start",
      "--hostname",
      "localhost",
      "--port",
      String(puertos.web),
    ],
    { cwd: unir(raiz, "Frontend"), env: entornoWeb },
  );
  await esperarHttp(`http://localhost:${puertos.web}/signin`, web);
  const inicioConexion = Date.now();
  while (!conectado && Date.now() - inicioConexion < 30000) await esperar(500);
  if (!conectado)
    throw new Error(
      "Cloudflare todavía no registró una conexión con su red. Revisa cloudflare.log.",
    );
  for (const servicio of [tunel, api, web]) {
    if (servicio.exitCode !== null || servicio.signalCode)
      throw new Error("Un servicio terminó durante el arranque.");
    servicio.once("exit", () => {
      if (!cerrando)
        void detener(
          new Error(
            "Se detuvo un servicio del acceso HTTPS. El administrador local conserva sus procesos.",
          ),
        );
    });
  }
  await escribirArchivo(
    unir(directorioLocal, "enlace.txt"),
    origen + "/mis-viajes\n",
  );
  await guardar({ estado: "listo", paso: "Acceso HTTPS del chofer listo" });
} catch (error) {
  await detener(error);
}
