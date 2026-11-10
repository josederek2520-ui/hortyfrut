import type { ClienteApi } from "@/lib/chofer/infraestructura/api/ClienteApi";
import { exigirIdentificador } from "@/lib/chofer/compartido/dominio/Pagina";
import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
import type {
  RepositorioSeguimiento,
  SesionSeguimiento,
  InicioSeguimiento,
  CierreSeguimiento,
  LoteUbicaciones,
} from "../dominio/Seguimiento";

function leerSesion(valor: unknown): SesionSeguimiento {
  const datos = valor as Record<string, unknown> | null;
  if (
    !datos ||
    typeof datos.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(datos.id) ||
    typeof datos.activa !== "boolean" ||
    typeof datos.vence_en !== "string" ||
    !Number.isFinite(Date.parse(datos.vence_en))
  )
    throw new ErrorAplicacion("datos");
  return { id: datos.id, activa: datos.activa, venceEn: datos.vence_en };
}
export class RepositorioSeguimientoHttp implements RepositorioSeguimiento {
  private ultimoAcuse: { sesion: string; instante: number } | null = null;
  constructor(
    private readonly cliente: ClienteApi,
    private readonly ahora = Date.now,
    private readonly esperar = (milisegundos: number) =>
      new Promise<void>((resolver) => setTimeout(resolver, milisegundos)),
  ) {}
  private ruta(viaje: number, accion: string) {
    return `chofer/mis-viajes/${exigirIdentificador(viaje)}/${accion}/`;
  }
  async iniciar(viaje: number, documento: InicioSeguimiento) {
    return leerSesion(
      await this.cliente.solicitar(this.ruta(viaje, "iniciar-seguimiento"), {
        metodo: "POST",
        cuerpo: documento,
      }),
    );
  }
  async detener(viaje: number, documento: CierreSeguimiento) {
    return leerSesion(
      await this.cliente.solicitar(this.ruta(viaje, "detener-seguimiento"), {
        metodo: "POST",
        cuerpo: documento,
      }),
    );
  }
  async enviar(viaje: number, documento: LoteUbicaciones) {
    // Una red lenta puede acumular muestras: espaciar los lotes después del acuse
    // anterior de esa sesión evita chocar con los 2 s mínimos del servidor.
    const ultimoAcuse = this.ultimoAcuse;
    if (ultimoAcuse && ultimoAcuse.sesion === documento.sesion) {
      const demora = 2100 - (this.ahora() - ultimoAcuse.instante);
      if (demora > 0) await this.esperar(demora);
    }
    const datos = await this.cliente.solicitar<{ sesion: unknown }>(
      this.ruta(viaje, "enviar-posiciones"),
      { metodo: "POST", cuerpo: documento },
    );
    const sesion = leerSesion(datos.sesion);
    this.ultimoAcuse = { sesion: documento.sesion, instante: this.ahora() };
    return sesion;
  }
}
