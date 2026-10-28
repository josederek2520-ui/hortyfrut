import type {
  AsignacionEditable,
  DocumentoEditable,
  NecesidadPreparacion,
  Preparacion,
  ProductoPreparacion,
} from "./tipos";
const cero = BigInt(0);
const mil = BigInt(1000);

export function aMiles(valor: string): bigint {
  if (!/^\d{1,11}(\.\d{1,3})?$/.test(valor || "0")) return cero;
  const [entero, decimal = ""] = (valor || "0").split(".");
  return BigInt(entero) * mil + BigInt(decimal.padEnd(3, "0"));
}
export function deMiles(valor: bigint): string {
  const signo = valor < 0 ? "-" : "";
  const absoluto = valor < 0 ? -valor : valor;
  return `${signo}${absoluto / mil}.${String(absoluto % mil).padStart(3, "0")}`;
}
export function asignadoLote(
  documento: DocumentoEditable,
  lote: number,
): bigint {
  return Object.values(documento.asignaciones).reduce(
    (total, asignacion) =>
      total + aMiles(asignacion.aportes[lote]?.cantidad || "0"),
    cero,
  );
}
export function desdeNecesidad(
  fuente: NecesidadPreparacion,
): AsignacionEditable {
  return {
    clave: String(fuente.id),
    detalle: fuente.id,
    pedido: fuente.pedido,
    codigo: fuente.codigo,
    sucursal: fuente.sucursal,
    sucursalNombre: fuente.sucursal_nombre,
    producto: fuente.producto,
    productoNombre: fuente.producto_nombre,
    presentacion: fuente.presentacion_nombre,
    columna: fuente.columna,
    solicitada: fuente.cantidad,
    pendiente: fuente.pendiente,
    disponible: fuente.disponible,
    cantidad: "",
    aportes: {},
  };
}
export function desdePreparacion(preparacion?: Preparacion): DocumentoEditable {
  return {
    lineas:
      preparacion?.lineas.map((linea) => ({
        lote: {
          id: linea.lote,
          nombre: linea.lote_codigo,
          producto: linea.producto,
          producto_nombre: linea.producto_nombre,
          unidad: linea.unidad,
          unidad_nombre: linea.unidad_nombre,
          unidad_abreviatura: linea.unidad_abreviatura,
          es_kg: linea.es_kg,
          producto_imagen: linea.producto_imagen,
          producto_categoria: linea.producto_categoria,
        },
        merma: linea.merma,
        aprovechable: linea.aprovechable,
        motivo: linea.motivo_separacion,
      })) || [],
    asignaciones: Object.fromEntries(
      preparacion?.asignaciones.map((asignacion) => {
        const clave = asignacion.detalle_pedido
          ? String(asignacion.detalle_pedido)
          : `retirada-${asignacion.id}`;
        return [
          clave,
          {
            clave,
            detalle: asignacion.detalle_pedido,
            pedido: asignacion.pedido,
            codigo: asignacion.codigo,
            sucursal: asignacion.sucursal,
            sucursalNombre: asignacion.sucursal_nombre,
            producto: asignacion.producto,
            productoNombre: asignacion.producto_nombre,
            presentacion: asignacion.presentacion_nombre,
            columna: asignacion.columna,
            solicitada: asignacion.cantidad_solicitada,
            pendiente: asignacion.pendiente_actual,
            disponible: asignacion.disponible,
            cantidad: String(asignacion.cantidad),
            aportes: Object.fromEntries(
              asignacion.aportes.map((aporte) => [
                aporte.lote,
                { cantidad: aporte.cantidad, pesoKg: aporte.peso_kg || "" },
              ]),
            ),
            imagen: asignacion.producto_imagen,
            categoria: asignacion.producto_categoria,
          },
        ];
      }) || [],
    ),
    cajillas:
      preparacion?.cajillas.map((fila) => ({
        clave: String(fila.id),
        sucursal: { id: fila.sucursal, nombre: fila.sucursal_nombre },
        color: { id: fila.cajilla, nombre: fila.color },
        cantidad: String(fila.cantidad),
      })) || [],
  };
}
export function serializarDocumento(documento: DocumentoEditable) {
  return {
    lineas: documento.lineas.map((linea) => ({
      lote: linea.lote.id,
      cantidad_utilizada: deMiles(
        asignadoLote(documento, linea.lote.id) +
          aMiles(linea.merma) +
          aMiles(linea.aprovechable),
      ),
      merma: linea.merma || "0",
      aprovechable: linea.aprovechable || "0",
      motivo_separacion: linea.motivo.trim(),
    })),
    asignaciones: Object.values(documento.asignaciones).map((asignacion) => ({
      detalle_pedido: asignacion.detalle,
      cantidad: Number(asignacion.cantidad || "0"),
      aportes: aportesConMedicion(asignacion, documento).map(
        ([lote, aporte]) => ({
          lote: Number(lote),
          cantidad: aporte.cantidad || "0",
          peso_kg: documento.lineas.find(
            (linea) => linea.lote.id === Number(lote),
          )?.lote.es_kg
            ? null
            : aporte.pesoKg || null,
        }),
      ),
    })),
    cajillas: documento.cajillas.map((fila) => ({
      sucursal: fila.sucursal.id,
      cajilla: fila.color.id,
      cantidad: Number(fila.cantidad || "0"),
    })),
  };
}
export function aportesConMedicion(
  asignacion: AsignacionEditable,
  documento: DocumentoEditable,
) {
  return Object.entries(asignacion.aportes).filter(([lote, aporte]) => {
    const esKg = documento.lineas.find(
      (linea) => linea.lote.id === Number(lote),
    )?.lote.es_kg;
    return (
      (aporte.cantidad !== "" && Number(aporte.cantidad) !== 0) ||
      (!esKg && !!aporte.pesoKg)
    );
  });
}

export function productosDelDocumento(
  documento: DocumentoEditable,
): ProductoPreparacion[] {
  const productos = new Map<number, ProductoPreparacion>();
  documento.lineas.forEach(({ lote }) =>
    productos.set(lote.producto, {
      id: lote.producto,
      nombre: lote.producto_nombre,
      imagen: lote.producto_imagen,
      categoria: lote.producto_categoria,
    }),
  );
  Object.values(documento.asignaciones).forEach((asignacion) => {
    const anterior = productos.get(asignacion.producto);
    productos.set(asignacion.producto, {
      ...anterior,
      id: asignacion.producto,
      nombre: asignacion.productoNombre,
      imagen: asignacion.imagen || anterior?.imagen,
      categoria: asignacion.categoria || anterior?.categoria,
    });
  });
  return [...productos.values()].sort((primero, segundo) =>
    primero.nombre.localeCompare(segundo.nombre),
  );
}

export function quitarLoteDocumento(
  documento: DocumentoEditable,
  lote: number,
): DocumentoEditable {
  return {
    ...documento,
    lineas: documento.lineas.filter((linea) => linea.lote.id !== lote),
    asignaciones: Object.fromEntries(
      Object.entries(documento.asignaciones).map(([clave, asignacion]) => {
        const aportes = { ...asignacion.aportes };
        delete aportes[lote];
        return [clave, { ...asignacion, aportes }];
      }),
    ),
  };
}
