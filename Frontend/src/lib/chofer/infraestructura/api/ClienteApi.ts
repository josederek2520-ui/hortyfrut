import { api, ApiError } from "@/lib/api";
import { ErrorAplicacion } from "../../compartido/dominio/Errores";

export class ClienteApi {
  alNoAutorizado: () => void = () => {};
  establecerAlNoAutorizado(escucha: () => void) {
    this.alNoAutorizado = escucha;
  }
  async solicitar<T>(
    ruta: string,
    opciones: {
      metodo?: "GET" | "POST";
      cuerpo?: unknown;
      senal?: AbortSignal;
    } = {},
  ): Promise<T> {
    if (
      !/^chofer\/mis-viajes\/[a-z0-9/?=&_-]*$/i.test(ruta) ||
      ruta.includes("..")
    )
      throw new ErrorAplicacion("configuracion");
    const controlador = new AbortController();
    const abortar = () => controlador.abort();
    if (opciones.senal?.aborted) abortar();
    opciones.senal?.addEventListener("abort", abortar, { once: true });
    const espera = setTimeout(abortar, 20000);
    try {
      return await api<T>(ruta, {
        method: opciones.metodo ?? "GET",
        body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
        signal: controlador.signal,
      });
    } catch (error) {
      if (!(error instanceof ApiError))
        throw new ErrorAplicacion("conexion", 0);
      if ([401, 403].includes(error.status)) this.alNoAutorizado();
      const codigo =
        error.status === 401
          ? "sesion"
          : error.status === 403
            ? "permiso"
            : error.status === 409
              ? "conflicto"
              : error.status === 404
                ? "noDisponible"
                : error.status === 429
                  ? "intentos"
                  : error.status === 400
                    ? "validacion"
                    : "conexion";
      throw new ErrorAplicacion(
        codigo,
        error.status,
        Object.values(error.errors)
          .flat()
          .slice(0, 3)
          .join(" ")
          .slice(0, 500) || error.message,
      );
    } finally {
      clearTimeout(espera);
      opciones.senal?.removeEventListener("abort", abortar);
    }
  }
}
