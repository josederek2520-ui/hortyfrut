import { consultarEstado } from "./control_local.mjs";
try {
  const estado = await consultarEstado();
  const respuesta = await fetch(
    `http://127.0.0.1:${estado.puertos.pasarela}/__control-chofer`,
    {
      method: "POST",
      headers: { "X-Control-Chofer": estado.claveControl },
      signal: AbortSignal.timeout(3000),
    },
  );
  if (!respuesta.ok)
    throw new Error("No se pudo detener el acceso del chofer.");
  console.log(
    "Acceso HTTPS del chofer detenido. La administración local conserva sus procesos.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
