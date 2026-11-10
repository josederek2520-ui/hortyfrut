import type { ClienteApi } from "@/lib/chofer/infraestructura/api/ClienteApi";
import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
import { exigirIdentificador } from "@/lib/chofer/compartido/dominio/Pagina";
import type {
  DocumentoGuia,
  RespuestaGuia,
  RepositorioGuia,
  LineaGuia,
} from "../dominio/GuiaChofer";

export class RepositorioGuiaHttp implements RepositorioGuia {
  constructor(private readonly cliente: ClienteApi) {}
  async consultar(
    viaje: number,
    documento: DocumentoGuia,
    senal: AbortSignal,
  ): Promise<RespuestaGuia> {
    const dato = await this.cliente.solicitar<Record<string, unknown>>(
      `chofer/mis-viajes/${exigirIdentificador(viaje)}/guia-destino/`,
      { metodo: "POST", cuerpo: documento, senal },
    );
    if (
      !dato ||
      dato.consulta !== documento.clave_operacion ||
      dato.sesion !== documento.sesion ||
      dato.plan !== documento.plan ||
      dato.tramo !== documento.tramo ||
      dato.version_despacho !== documento.version ||
      dato.trafico_en_vivo !== false ||
      !["pendiente", "lista", "error"].includes(String(dato.estado)) ||
      typeof dato.vence_en !== "string" ||
      !Number.isFinite(Date.parse(dato.vence_en))
    )
      throw new ErrorAplicacion("respuestaInvalida");
    let geometria: LineaGuia | null = null;
    if (dato.estado === "lista") {
      const linea = dato.geometria as LineaGuia | null;
      if (
        !linea ||
        linea.type !== "LineString" ||
        !Array.isArray(linea.coordinates) ||
        linea.coordinates.length < 2 ||
        linea.coordinates.length > 100000 ||
        linea.coordinates.some(
          (p) =>
            !Array.isArray(p) ||
            p.length !== 2 ||
            !p.every((n) => typeof n === "number" && Number.isFinite(n)) ||
            Math.abs(p[0]) > 180 ||
            Math.abs(p[1]) > 90,
        )
      )
        throw new ErrorAplicacion("respuestaInvalida");
      geometria = linea;
    }
    return {
      consulta: String(dato.consulta),
      estado: dato.estado as RespuestaGuia["estado"],
      sesion: documento.sesion,
      plan: documento.plan,
      tramo: documento.tramo,
      version: documento.version,
      venceEn: dato.vence_en,
      geometria,
    };
  }
}
