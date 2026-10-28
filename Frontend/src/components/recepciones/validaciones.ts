import type { FieldErrors as ErroresCampos } from "@/lib/form-validation";
import { aMilesRecepcion, mismaUnidadRecepcion } from "./calculos";
import type { LineaRecepcion } from "./tipos";

interface MensajesRecepcion {
  cantidad: string;
  positiva: string;
  peso: string;
  vencimiento: string;
  pendiente: string;
  mismaUnidad: string;
  sinLineas: string;
  limite: string;
}

export function validarLineasRecepcion(
  lineas: LineaRecepcion[],
  vinculada: boolean,
  confirmar: boolean,
  fecha: string,
  mensajes: MensajesRecepcion,
): ErroresCampos {
  const errores: ErroresCampos = {};
  if (confirmar && !lineas.length) errores.detalles = [mensajes.sinLineas];
  if (lineas.length > 500) errores.detalles = [mensajes.limite];
  lineas.forEach((linea, indice) => {
    const campo = (nombre: string) => `detalle_${indice}_${nombre}`;
    const cantidad = aMilesRecepcion(linea.cantidadInventario);
    const compra = aMilesRecepcion(linea.cantidadCompra, 9);
    if (cantidad === null)
      errores[campo("cantidad_inventario")] = [mensajes.cantidad];
    else if (confirmar && cantidad <= BigInt(0))
      errores[campo("cantidad_inventario")] = [mensajes.positiva];
    if (vinculada) {
      if (compra === null)
        errores[campo("cantidad_compra")] = [mensajes.cantidad];
      else if (confirmar && compra <= BigInt(0))
        errores[campo("cantidad_compra")] = [mensajes.positiva];
      else if (linea.pendiente !== undefined) {
        const pendiente = aMilesRecepcion(linea.pendiente, 9);
        if (confirmar && pendiente !== null && compra > pendiente)
          errores[campo("cantidad_compra")] = [mensajes.pendiente];
      }
      if (
        confirmar &&
        mismaUnidadRecepcion(linea) &&
        cantidad !== null &&
        compra !== null &&
        cantidad !== compra
      )
        errores[campo("cantidad_inventario")] = [mensajes.mismaUnidad];
    }
    if (!linea.unidad.es_kg && linea.pesoKg.trim()) {
      const peso = aMilesRecepcion(linea.pesoKg);
      if (peso === null || peso <= BigInt(0))
        errores[campo("peso_kg")] = [mensajes.peso];
    }
    if (
      linea.vencimiento &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(linea.vencimiento) ||
        linea.vencimiento < fecha)
    )
      errores[campo("fecha_vencimiento")] = [mensajes.vencimiento];
  });
  return errores;
}
