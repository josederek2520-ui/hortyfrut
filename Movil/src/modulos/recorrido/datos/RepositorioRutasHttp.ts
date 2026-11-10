import type { ClienteApi } from "@/infraestructura/api/ClienteApi";
import { exigirIdentificador } from "@/compartido/dominio/Pagina";
import { leerRutaViaje } from "./transformacionesRuta";
import type {
  AccionRuta,
  DocumentoRuta,
  RepositorioRutas,
} from "../dominio/Ruta";

export class RepositorioRutasHttp implements RepositorioRutas {
  constructor(private readonly cliente: ClienteApi) {}
  async consultar(viaje: number, senal?: AbortSignal) {
    return leerRutaViaje(
      await this.cliente.solicitar(
        `movil/mis-despachos/${exigirIdentificador(viaje)}/ruta/`,
        { senal },
      ),
    );
  }
  async operar(viaje: number, accion: AccionRuta, documento: DocumentoRuta) {
    if (
      ![
        "calcular-ruta",
        "aprobar-ruta",
        "optimizar-ruta",
        "cancelar-optimizacion",
      ].includes(accion)
    )
      throw new Error("Operación de ruta no válida");
    return leerRutaViaje(
      await this.cliente.solicitar(
        `movil/mis-despachos/${exigirIdentificador(viaje)}/${accion}/`,
        { metodo: "POST", cuerpo: documento },
      ),
    );
  }
}
