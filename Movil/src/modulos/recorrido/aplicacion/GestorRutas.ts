import {
  ErrorAplicacion,
  resultadoIncierto,
} from "@/compartido/dominio/Errores";
import type {
  AccionRuta,
  DocumentoRuta,
  RepositorioRutas,
} from "../dominio/Ruta";

interface OperacionRutaPendiente {
  viaje: number;
  accion: AccionRuta;
  documento: DocumentoRuta;
}

export class GestorRutas {
  private pendientes = new Map<number, OperacionRutaPendiente>();
  private ocupados = new Set<number>();
  private generacion = 0;
  constructor(
    private readonly repositorio: RepositorioRutas,
    private readonly generarUuid: () => string,
    private readonly otraOperacion: (viaje: number) => boolean = () => false,
  ) {}
  pendiente(viaje: number) {
    return this.pendientes.get(viaje);
  }
  tieneOperacion(viaje: number) {
    return this.ocupados.has(viaje) || this.pendientes.has(viaje);
  }
  limpiar() {
    ++this.generacion;
    this.pendientes.clear();
  }
  async ejecutar(
    viaje: number,
    accion: AccionRuta,
    documento: Omit<DocumentoRuta, "clave_operacion">,
  ) {
    if (this.tieneOperacion(viaje)) throw new ErrorAplicacion("ocupado", 409);
    if (this.otraOperacion(viaje)) throw new ErrorAplicacion("pendiente", 409);
    const operacion = {
      viaje,
      accion,
      documento: {
        ...documento,
        ...(documento.orden_paradas
          ? { orden_paradas: [...documento.orden_paradas] }
          : {}),
        clave_operacion: this.generarUuid(),
      },
    };
    this.pendientes.set(viaje, operacion);
    return this.aplicar(operacion);
  }
  async reintentar(viaje: number) {
    const pendiente = this.pendientes.get(viaje);
    if (!pendiente) throw new ErrorAplicacion("conflicto", 409);
    return this.aplicar(pendiente);
  }
  private async aplicar(operacion: OperacionRutaPendiente) {
    if (this.ocupados.has(operacion.viaje))
      throw new ErrorAplicacion("ocupado", 409);
    this.ocupados.add(operacion.viaje);
    const generacion = this.generacion;
    try {
      const ruta = await this.repositorio.operar(
        operacion.viaje,
        operacion.accion,
        operacion.documento,
      );
      if (generacion !== this.generacion)
        throw new ErrorAplicacion("sesion", 401);
      this.pendientes.delete(operacion.viaje);
      return ruta;
    } catch (error) {
      if (!resultadoIncierto(error)) this.pendientes.delete(operacion.viaje);
      throw error;
    } finally {
      this.ocupados.delete(operacion.viaje);
    }
  }
}
