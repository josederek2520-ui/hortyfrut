import { getVersion, setWorkerUrl } from "maplibre-gl";

/** Worker ESM propio, de la misma version que el motor instalado. */
export function prepararMotorMapa() {
  setWorkerUrl(`/mapas/maplibre/${getVersion()}/worker.mjs`);
}
