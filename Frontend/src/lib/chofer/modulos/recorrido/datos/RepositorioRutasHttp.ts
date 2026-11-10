import type { ClienteApi } from "@/lib/chofer/infraestructura/api/ClienteApi";
import { exigirIdentificador } from "@/lib/chofer/compartido/dominio/Pagina";
import { leerRutaViaje, leerComparacionCaminos } from "./transformacionesRuta";
import type {
  AccionRuta,
  DocumentoRuta,
  RepositorioRutas,
  DocumentoConsultaCaminos,
} from "../dominio/Ruta";

export class RepositorioRutasHttp implements RepositorioRutas {
  constructor(private readonly cliente: ClienteApi) {}
  async consultarAlternativas(
    viaje: number,
    documento: DocumentoConsultaCaminos,
    senal?: AbortSignal,
  ) {
    return leerComparacionCaminos(
      await this.cliente.solicitar(
        `chofer/mis-viajes/${exigirIdentificador(viaje)}/consultar-alternativas/`,
        { metodo: "POST", cuerpo: documento, senal },
      ),
    );
  }
  async consultar(viaje: number, senal?: AbortSignal) {
    return leerRutaViaje(
      await this.cliente.solicitar(
        `chofer/mis-viajes/${exigirIdentificador(viaje)}/ruta/`,
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
        "elegir-alternativa",
      ].includes(accion)
    )
      throw new Error("Operación de ruta no válida");
    return leerRutaViaje(
      await this.cliente.solicitar(
        `chofer/mis-viajes/${exigirIdentificador(viaje)}/${accion}/`,
        { metodo: "POST", cuerpo: documento },
      ),
    );
  }
}
