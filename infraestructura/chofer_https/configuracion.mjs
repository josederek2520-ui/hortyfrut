import { fileURLToPath as rutaArchivo } from "node:url";
import { join as unir } from "node:path";

export const raiz = rutaArchivo(new URL("../../", import.meta.url));
export const directorioLocal = unir(raiz, ".local", "chofer_https");
export const archivoEstado = unir(directorioLocal, "estado.json");
export const versionCloudflared = "2026.10.7";
export const huellaCloudflared =
  "2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343";
export const origenBinario = `https://github.com/cloudflare/cloudflared/releases/download/${versionCloudflared}/cloudflared-windows-amd64.exe`;
export const puertos = { pasarela: 8787, web: 3001, api: 8001 };

export function validarOrigen(origen) {
  return (
    typeof origen === "string" &&
    /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(origen)
  );
}
