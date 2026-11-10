import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import {
  dirname,
  basename,
  join,
  resolve,
  relative,
  isAbsolute,
} from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

const { values: opciones } = parseArgs({
  options: {
    java: { type: "string" },
    sdk: { type: "string" },
    arquitecturas: { type: "string", default: "arm64-v8a" },
    salida: { type: "string" },
  },
});
if (
  !["arm64-v8a", "x86_64", "arm64-v8a,x86_64"].includes(opciones.arquitecturas)
)
  throw Error("Arquitecturas admitidas: arm64-v8a, x86_64 o arm64-v8a,x86_64.");

const raizMovil = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const javaLocal = join(raizMovil, ".herramientas/java/jdk-17.0.20.1+1");
const rutaJava = resolve(
  opciones.java ??
    (existsSync(javaLocal) ? javaLocal : process.env.JAVA_HOME) ??
    "C:/Program Files/Java/jdk-17",
);
const rutaSdk = resolve(
  opciones.sdk ??
    process.env.ANDROID_HOME ??
    join(raizMovil, ".herramientas/android-sdk"),
);
const ejecutableJava = join(rutaJava, "bin/java.exe");
if (!existsSync(ejecutableJava)) throw Error("Indica un JDK 17 con --java.");
if (
  !["android-37", "android-37.0"].some((plataforma) =>
    existsSync(join(rutaSdk, "platforms", plataforma, "android.jar")),
  )
)
  throw Error("Falta Android SDK 37. Indica su carpeta con --sdk.");

// Un alias temporal acorta las rutas sin mover archivos ni cambiar Windows.
let raizCompilacion = raizMovil;
let unidadTemporal = null;
const origenAlias = dirname(raizMovil);
for (const letra of ["R", "S", "T", "U", "V", "W", "X", "Y", "Z"]) {
  const unidad = `${letra}:`;
  const resultado = spawnSync("subst.exe", [unidad, origenAlias], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (resultado.status === 0) {
    unidadTemporal = unidad;
    raizCompilacion = join(`${unidad}\\`, basename(raizMovil));
    break;
  }
}
if (!unidadTemporal)
  throw Error("No hay una letra libre para el alias temporal de compilacion.");
function acortarRuta(ruta) {
  const parte = relative(raizMovil, ruta);
  return parte !== ".." && !parte.startsWith("..\\") && !isAbsolute(parte)
    ? join(raizCompilacion, parte)
    : ruta;
}

// El entorno solo se hereda a los procesos de compilacion. No abre dispositivos.
const entorno = {
  ...process.env,
  HORTYFRU_RAIZ_FISICA: raizMovil,
  JAVA_HOME: acortarRuta(rutaJava),
  ANDROID_HOME: acortarRuta(rutaSdk),
  ANDROID_SDK_ROOT: acortarRuta(rutaSdk),
  GRADLE_USER_HOME: join(raizCompilacion, ".herramientas/gradle"),
};
function ejecutar(archivo, argumentos, directorio) {
  const resultado = spawnSync(archivo, argumentos, {
    cwd: directorio,
    env: entorno,
    stdio: "inherit",
    windowsHide: true,
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0)
    throw Error(`La compilacion termino con codigo ${resultado.status ?? 1}.`);
}

try {
  const requerir = createRequire(import.meta.url);
  ejecutar(
    process.execPath,
    [
      requerir.resolve("expo/bin/cli"),
      "prebuild",
      "--platform",
      "android",
      "--no-install",
    ],
    raizCompilacion,
  );
  ejecutar(
    acortarRuta(ejecutableJava),
    [
      "-Xmx64m",
      "-classpath",
      join(raizCompilacion, "android/gradle/wrapper/gradle-wrapper.jar"),
      "org.gradle.wrapper.GradleWrapperMain",
      ":app:assembleDebug",
      "--no-daemon",
      "--console=plain",
      "--stacktrace",
      "--max-workers=2",
      "-Pkotlin.incremental=false",
      `-PreactNativeArchitectures=${opciones.arquitecturas}`,
    ],
    join(raizCompilacion, "android"),
  );

  const archivoApk = resolve(
    raizMovil,
    opciones.salida ?? "dist/apk/hortyfru-chofer-desarrollo.apk",
  );
  const rutaRelativaApk = relative(raizMovil, archivoApk);
  if (
    rutaRelativaApk === ".." ||
    rutaRelativaApk.startsWith("..\\") ||
    isAbsolute(rutaRelativaApk)
  )
    throw Error("La salida del APK debe permanecer dentro de Movil.");
  mkdirSync(dirname(archivoApk), { recursive: true });
  copyFileSync(
    join(raizMovil, "android/app/build/outputs/apk/debug/app-debug.apk"),
    archivoApk,
  );
  console.log(`APK de desarrollo: ${archivoApk}`);
  console.log(
    "Este APK necesita Metro (npm.cmd start). No es la distribucion definitiva.",
  );
} finally {
  // Solo retirar el alias que este proceso creo y que aun apunta al proyecto.
  const actual = spawnSync("subst.exe", [], {
    encoding: "utf8",
    windowsHide: true,
  });
  const lineaAlias = actual.stdout
    ?.split(/\r?\n/)
    .find((linea) => linea.startsWith(`${unidadTemporal}\\`));
  if (
    lineaAlias?.split("=>")[1]?.trim().toLowerCase() ===
    origenAlias.toLowerCase()
  )
    spawnSync("subst.exe", [unidadTemporal, "/d"], { windowsHide: true });
}
