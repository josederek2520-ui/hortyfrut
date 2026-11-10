import type {
  DocumentoOperacion,
  RepositorioDespachos,
} from "@/modulos/despachos/dominio/RepositorioDespachos";
import {
  ErrorAplicacion,
  resultadoIncierto,
} from "@/compartido/dominio/Errores";
export interface OperacionPendiente {
  viaje: number;
  accion: string;
  documento: DocumentoOperacion;
}

export class GestorOperaciones {
  private pendientes = new Map<number, OperacionPendiente>();
  private ocupados = new Set<number>();
  private generacion = 0;
  constructor(
    private readonly repositorio: RepositorioDespachos,
    private readonly generarUuid: () => string,
    private readonly otraOperacion: (viaje: number) => boolean = () => false,
    private readonly alIntentarFinalizar: (viaje: number) => void = () => {},
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
    accion: string,
    documento: Omit<DocumentoOperacion, "clave_operacion">,
  ) {
    if (this.ocupados.has(viaje)) throw new ErrorAplicacion("ocupado", 409);
    if (this.otraOperacion(viaje)) throw new ErrorAplicacion("pendiente", 409);
    if (this.pendientes.has(viaje)) throw new ErrorAplicacion("pendiente", 409);
    const operacion = {
      viaje,
      accion,
      documento: {
        ...documento,
        cargas_comprobadas: documento.cargas_comprobadas
          ? [...documento.cargas_comprobadas]
          : undefined,
        clave_operacion: this.generarUuid(),
      },
    };
    this.pendientes.set(viaje, operacion);
    return this.aplicar(operacion);
  }
  async reintentar(viaje: number) {
    const operacion = this.pendientes.get(viaje);
    if (!operacion) throw new ErrorAplicacion("conflicto", 409);
    return this.aplicar(operacion);
  }
  private async aplicar(operacion: OperacionPendiente) {
    if (this.ocupados.has(operacion.viaje))
      throw new ErrorAplicacion("ocupado", 409);
    this.ocupados.add(operacion.viaje);
    const generacion = this.generacion;
    try {
      if (operacion.accion === "finalizar")
        this.alIntentarFinalizar(operacion.viaje);
      const resultado = await this.repositorio.operar(
        operacion.viaje,
        operacion.accion,
        operacion.documento,
      );
      if (generacion !== this.generacion)
        throw new ErrorAplicacion("sesion", 401);
      this.pendientes.delete(operacion.viaje);
      return resultado;
    } catch (error) {
      if (!resultadoIncierto(error)) this.pendientes.delete(operacion.viaje);
      throw error;
    } finally {
      this.ocupados.delete(operacion.viaje);
    }
  }
}
