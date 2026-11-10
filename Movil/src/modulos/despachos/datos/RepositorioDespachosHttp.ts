import type { ClienteApi } from "@/infraestructura/api/ClienteApi";
import { exigirIdentificador as id } from "@/compartido/dominio/Pagina";
import type {
  DocumentoOperacion,
  RepositorioDespachos,
} from "../dominio/RepositorioDespachos";
import {
  leerViaje,
  leerDetalle,
  leerPagina,
  leerPedido,
  leerProducto,
} from "./transformaciones";

export class RepositorioDespachosHttp implements RepositorioDespachos {
  constructor(private readonly cliente: ClienteApi) {}
  async listar(pagina: number, estado: string, senal?: AbortSignal) {
    if (
      !["", "borrador", "en_ruta", "finalizado", "cancelado"].includes(estado)
    )
      throw Error("Estado no válido");
    return leerPagina(
      await this.cliente.solicitar(
        `movil/mis-despachos/?page=${id(pagina)}${estado ? `&estado=${estado}` : ""}`,
        { senal },
      ),
      pagina,
      leerViaje,
    );
  }
  async detalle(identificador: number, senal?: AbortSignal) {
    return leerDetalle(
      await this.cliente.solicitar(
        `movil/mis-despachos/${id(identificador)}/`,
        { senal },
      ),
    );
  }
  async pedidos(
    viaje: number,
    parada: number,
    pagina: number,
    senal?: AbortSignal,
  ) {
    return leerPagina(
      await this.cliente.solicitar(
        `movil/mis-despachos/${id(viaje)}/pedidos/?parada=${id(parada)}&pagina=${id(pagina)}`,
        { senal },
      ),
      pagina,
      leerPedido,
    );
  }
  async productos(
    viaje: number,
    parada: number,
    pedido: number,
    pagina: number,
    senal?: AbortSignal,
  ) {
    return leerPagina(
      await this.cliente.solicitar(
        `movil/mis-despachos/${id(viaje)}/productos-pedido/?parada=${id(parada)}&pedido=${id(pedido)}&pagina=${id(pagina)}`,
        { senal },
      ),
      pagina,
      leerProducto,
    );
  }
  async operar(viaje: number, accion: string, documento: DocumentoOperacion) {
    if (
      !["iniciar", "llegar", "descargar-pedido", "finalizar"].includes(accion)
    )
      throw Error("Operación no válida");
    return leerDetalle(
      await this.cliente.solicitar(
        `movil/mis-despachos/${id(viaje)}/${accion}/`,
        { metodo: "POST", cuerpo: documento },
      ),
    );
  }
}
