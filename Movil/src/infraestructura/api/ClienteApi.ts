import { ErrorAplicacion } from "@/compartido/dominio/Errores";

export function normalizarServidor(valor: string, desarrollo: boolean): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new ErrorAplicacion("configuracion");
  }
  if (
    (url.protocol !== "https:" && !(desarrollo && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/\/api\/v1\/?$/.test(url.pathname)
  )
    throw new ErrorAplicacion("configuracion");
  return url.toString().replace(/\/?$/, "/");
}
export interface OpcionesPeticion {
  metodo?: "GET" | "POST" | "DELETE";
  cuerpo?: unknown;
  senal?: AbortSignal;
  credencial?: string | null;
}

async function leerErrorAcceso(respuesta: Response): Promise<string> {
  let detalle: unknown;
  try {
    detalle = await respuesta.json();
  } catch {
    return "configuracion";
  }
  if (!detalle || typeof detalle !== "object" || !("errors" in detalle))
    return "configuracion";
  const errores = detalle.errors;
  if (
    Array.isArray(errores) &&
    errores.includes("El correo o la contraseña no son correctos.")
  )
    return "credenciales";
  return "validacionAcceso";
}

export class ClienteApi {
  alNoAutorizado: () => void = () => {};
  constructor(
    readonly servidor: string,
    private readonly credencial: () => Promise<string | null>,
    private readonly transporte: typeof fetch = fetch,
  ) {}
  async solicitar<T>(
    ruta: string,
    opciones: OpcionesPeticion = {},
  ): Promise<T> {
    if (
      !this.servidor ||
      !/^movil\/[a-z0-9/?=&_-]+$/i.test(ruta) ||
      ruta.includes("..")
    )
      throw new ErrorAplicacion("configuracion");
    const controlador = new AbortController();
    const abortar = () => controlador.abort();
    if (opciones.senal?.aborted) abortar();
    opciones.senal?.addEventListener("abort", abortar, { once: true });
    const temporizador = setTimeout(abortar, 20000);
    try {
      const credencial =
        opciones.credencial === undefined
          ? await this.credencial()
          : opciones.credencial;
      const respuesta = await this.transporte(this.servidor + ruta, {
        method: opciones.metodo ?? "GET",
        signal: controlador.signal,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(opciones.cuerpo ? { "Content-Type": "application/json" } : {}),
          ...(credencial ? { Authorization: `Bearer ${credencial}` } : {}),
        },
        body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      });
      if (!respuesta.ok) {
        if (
          respuesta.status === 401 &&
          credencial &&
          credencial === (await this.credencial())
        )
          this.alNoAutorizado();
        const codigo =
          respuesta.status === 401
            ? "sesion"
            : respuesta.status === 403
              ? "permiso"
              : respuesta.status === 409
                ? "conflicto"
                : respuesta.status === 429
                  ? "intentos"
                  : respuesta.status === 404
                    ? "noDisponible"
                    : respuesta.status === 400 &&
                        ruta === "movil/iniciar-sesion/"
                      ? await leerErrorAcceso(respuesta)
                      : respuesta.status === 400
                        ? "validacion"
                        : "conexion";
        let detalle: string | undefined;
        if (
          respuesta.status === 400 &&
          /^movil\/mis-despachos\/\d+\//.test(ruta)
        ) {
          try {
            const datos = (await respuesta.json()) as { errors?: unknown };
            const valores =
              datos?.errors && typeof datos.errors === "object"
                ? Object.values(datos.errors).flat()
                : [];
            detalle =
              valores
                .filter((valor): valor is string => typeof valor === "string")
                .slice(0, 3)
                .join(" ")
                .slice(0, 500) || undefined;
          } catch {
            /* Conserva el mensaje general cuando la respuesta no tiene detalles válidos. */
          }
        }
        throw new ErrorAplicacion(codigo, respuesta.status, detalle);
      }
      if (respuesta.status === 204) return undefined as T;
      try {
        return (await respuesta.json()) as T;
      } catch {
        throw new ErrorAplicacion("datos", 502);
      }
    } catch (error) {
      if (error instanceof ErrorAplicacion) throw error;
      throw new ErrorAplicacion("conexion", 0);
    } finally {
      clearTimeout(temporizador);
      opciones.senal?.removeEventListener("abort", abortar);
    }
  }
}
