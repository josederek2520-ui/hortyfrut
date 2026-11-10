import type { ClienteApi } from "@/infraestructura/api/ClienteApi";
import { exigirIdentificador } from "@/compartido/dominio/Pagina";
import { ErrorAplicacion } from "@/compartido/dominio/Errores";
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
  constructor(private readonly cliente: ClienteApi) {}
  private ruta(viaje: number, accion: string) {
    return `movil/mis-despachos/${exigirIdentificador(viaje)}/${accion}/`;
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
    const datos = await this.cliente.solicitar<{ sesion: unknown }>(
      this.ruta(viaje, "enviar-posiciones"),
      { metodo: "POST", cuerpo: documento },
    );
    return leerSesion(datos.sesion);
  }
}
