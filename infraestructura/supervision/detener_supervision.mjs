import { consultarEstado } from "./control_local.mjs";
try {
  const estado = await consultarEstado();
  process.kill(estado.pid, "SIGTERM");
  console.log(
    "Supervisión detenida. Los demás servicios conservan sus procesos.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
