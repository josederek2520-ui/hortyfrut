import type { ProductoPedido } from "@/modulos/despachos/dominio/Viaje";
import { ErrorAplicacion } from "@/compartido/dominio/Errores";

export class RevisionPedido {
  private filas = new Map<number, ProductoPedido>();
  private comprobadas = new Set<number>();
  private total: number | null = null;
  constructor(
    readonly pedido: number,
    readonly version: string,
  ) {}
  incorporar(productos: ProductoPedido[], total: number) {
    if (
      !Number.isInteger(total) ||
      total < 1 ||
      total > 1000 ||
      (this.total !== null && this.total !== total)
    )
      throw new ErrorAplicacion("conflicto", 409);
    this.total = total;
    for (const producto of productos) {
      if (producto.pedido !== this.pedido)
        throw new ErrorAplicacion("datos", 502);
      this.filas.set(producto.id, producto);
    }
  }
  alternar(identificador: number) {
    const fila = this.filas.get(identificador);
    if (!fila || fila.descargadaEn) return;
    if (this.comprobadas.has(identificador))
      this.comprobadas.delete(identificador);
    else this.comprobadas.add(identificador);
  }
  estaComprobada(identificador: number) {
    return this.comprobadas.has(identificador);
  }
  get cantidad() {
    return this.comprobadas.size;
  }
  get completa() {
    return (
      this.total !== null &&
      this.comprobadas.size === this.total &&
      this.filas.size === this.total
    );
  }
  obtenerComprobadas() {
    if (!this.completa) throw new ErrorAplicacion("revision", 400);
    return [...this.comprobadas].sort((a, b) => a - b);
  }
}
