import type {
  Viaje,
  ViajeDetalle,
  Pedido,
  ProductoPedido,
  Parada,
} from "../dominio/Viaje";
import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
type Registro = Record<string, unknown>;
function registro(valor: unknown): Registro {
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    throw new ErrorAplicacion("datos", 502);
  return valor as Registro;
}
function texto(valor: unknown): string {
  if (typeof valor !== "string") throw new ErrorAplicacion("datos", 502);
  return valor;
}
function numero(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < 0)
    throw new ErrorAplicacion("datos", 502);
  return valor;
}
function fecha(valor: unknown) {
  return valor == null ? null : texto(valor);
}
function lista(valor: unknown) {
  if (!Array.isArray(valor)) throw new ErrorAplicacion("datos", 502);
  return valor as unknown[];
}
export function leerViaje(valor: unknown): Viaje {
  const datos = registro(valor),
    resumen = registro(datos.resumen);
  const estado = texto(datos.estado);
  const destino =
    datos.siguiente_destino == null ? null : registro(datos.siguiente_destino);
  if (
    !["borrador", "en_ruta", "finalizado", "cancelado"].includes(estado) ||
    !/^[0-9a-f]{64}$/.test(texto(datos.version))
  )
    throw new ErrorAplicacion("datos", 502);
  return {
    id: numero(datos.id),
    codigo: texto(datos.codigo),
    estado: estado as Viaje["estado"],
    fechaReparto: texto(datos.fecha_reparto),
    vehiculo: texto(datos.vehiculo_placa),
    chofer: texto(datos.chofer_nombre),
    almacen: texto(datos.almacen_nombre),
    enviadoEn: fecha(datos.enviado_en),
    siguienteDestino: destino
      ? {
          cliente: texto(destino.cliente_nombre),
          sucursal: texto(destino.sucursal_nombre),
        }
      : null,
    version: texto(datos.version),
    resumen: {
      cajas: numero(resumen.cajas),
      unidades: numero(resumen.unidades),
      pesoKg: texto(resumen.peso_kg),
      paradas: numero(resumen.paradas),
      completadas: numero(resumen.completadas),
      pedidos: numero(resumen.pedidos),
      pedidosDescargados: numero(resumen.pedidos_descargados),
      cajillas: numero(resumen.cajillas),
    },
  };
}
export function leerDetalle(valor: unknown): ViajeDetalle {
  const datos = registro(valor),
    capacidad = texto(registro(datos.comprobacion_capacidad).estado);
  if (
    ![
      "apta",
      "sin_carga",
      "sin_capacidad",
      "peso_incompleto",
      "excedida",
    ].includes(capacidad)
  )
    throw new ErrorAplicacion("datos", 502);
  return {
    ...leerViaje(valor),
    capacidad: capacidad as ViajeDetalle["capacidad"],
    observaciones: texto(datos.observaciones),
    paradas: lista(datos.paradas).map((valor): Parada => {
      const fila = registro(valor);
      return {
        id: numero(fila.id),
        sucursal: numero(fila.sucursal),
        cliente: texto(fila.cliente_nombre),
        nombre: texto(fila.sucursal_nombre),
        direccion: texto(fila.direccion),
        orden: numero(fila.orden),
        llegadaEn: fecha(fila.llegada_en),
        descargadaEn: fecha(fila.descargada_en),
        pedidos: numero(fila.pedidos),
        pedidosDescargados: numero(fila.pedidos_descargados),
      };
    }),
    cajillas: lista(datos.cajillas).map((valor) => {
      const fila = registro(valor);
      return {
        sucursal: numero(fila.sucursal),
        color: texto(fila.color),
        cantidad: numero(fila.cantidad),
      };
    }),
  };
}
export function leerPedido(valor: unknown): Pedido {
  const fila = registro(valor);
  return {
    id: numero(fila.pedido),
    parada: numero(fila.parada),
    codigo: texto(fila.codigo_pedido),
    fechaRequerida: texto(fila.fecha_requerida),
    cajas: numero(fila.cajas),
    unidades: numero(fila.unidades),
    pesoKg: texto(fila.peso_kg),
    productos: numero(fila.productos),
    asignaciones: numero(fila.asignaciones),
    descargadaEn: fecha(fila.descargada_en),
    responsable: texto(fila.responsable_descarga_nombre),
    registroAnterior: fila.registro_anterior === true,
  };
}
export function leerProducto(valor: unknown): ProductoPedido {
  const fila = registro(valor),
    columna = texto(fila.columna);
  if (columna !== "cajas" && columna !== "unidades")
    throw new ErrorAplicacion("datos", 502);
  return {
    id: numero(fila.id),
    pedido: numero(fila.pedido),
    codigoPedido: texto(fila.codigo_pedido),
    nombre: texto(fila.producto_nombre),
    imagen: fila.producto_imagen == null ? null : texto(fila.producto_imagen),
    cajillasPreparacion: lista(fila.cajillas_preparacion ?? []).map((valor) => {
      const cajilla = registro(valor);
      return {
        cajilla: numero(cajilla.cajilla),
        color: texto(cajilla.color),
        cantidad: numero(cajilla.cantidad),
      };
    }),
    presentacion: texto(fila.presentacion_nombre),
    columna,
    cantidad: numero(fila.cantidad),
    pesoKg: texto(fila.peso_kg),
    codigoPreparacion: texto(fila.codigo_preparacion),
    descargadaEn: fecha(fila.descargada_en),
    aportes: lista(fila.aportes).map((valor) => {
      const aporte = registro(valor);
      return {
        lote: numero(aporte.lote),
        codigo: texto(aporte.codigo_lote),
        cantidad: texto(aporte.cantidad),
        unidad: texto(aporte.unidad),
        pesoKg: texto(aporte.peso_kg),
      };
    }),
  };
}
export function leerPagina<T>(
  valor: unknown,
  pagina: number,
  transformar: (dato: unknown) => T,
) {
  const datos = registro(valor),
    filas = lista(datos.results);
  if (filas.length > 10) throw new ErrorAplicacion("datos", 502);
  return {
    registros: filas.map(transformar),
    total: numero(datos.count),
    pagina,
  };
}
