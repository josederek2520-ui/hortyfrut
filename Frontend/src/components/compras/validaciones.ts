import type { FieldErrors as ErroresCampos } from "@/lib/form-validation";
import type { LineaFormularioCompra } from "./tipos";
import { totalCentavos } from "./calculos";

interface MensajesValidacion {
  cantidad: string;
  precio: string;
  proveedor: string;
  cantidadPositiva: string;
  precioPositivo: string;
  sinLineas: string;
  duplicada: string;
  importe: string;
  totalPositivo: string;
}

// Revisa también las líneas fuera de la página visible. La API vuelve a validar
// los permisos, las referencias activas y los importes antes de registrar.
export function validarLineasCompra(
  lineas: LineaFormularioCompra[],
  registrar: boolean,
  mensajes: MensajesValidacion,
): ErroresCampos {
  const errores: ErroresCampos = {};
  const combinaciones = new Set<string>();
  if (registrar && !lineas.length) errores.detalles = [mensajes.sinLineas];
  lineas.forEach((linea, indice) => {
    const cantidad = linea.cantidad.trim();
    const precio = linea.precioUnitario.trim();
    const campo = (nombre: string) => `detalle_${indice}_${nombre}`;
    if (cantidad && !/^[0-9]{1,9}([.,][0-9]{1,3})?$/.test(cantidad))
      errores[campo("cantidad")] = [mensajes.cantidad];
    else if (registrar && !(Number(cantidad.replace(",", ".")) > 0))
      errores[campo("cantidad")] = [mensajes.cantidadPositiva];
    if (precio && !/^[0-9]{1,10}([.,][0-9]{1,2})?$/.test(precio))
      errores[campo("precio_unitario")] = [mensajes.precio];
    else if (registrar && !(Number(precio.replace(",", ".")) > 0))
      errores[campo("precio_unitario")] = [mensajes.precioPositivo];
    if (registrar && !linea.proveedor)
      errores[campo("proveedor")] = [mensajes.proveedor];
    if (linea.proveedor) {
      const combinacion = `${linea.producto.id}:${linea.presentacion?.id || 0}:${linea.proveedor.id}`;
      if (combinaciones.has(combinacion))
        errores[campo("proveedor")] = [mensajes.duplicada];
      combinaciones.add(combinacion);
    }
  });
  if (!Object.keys(errores).length) {
    const total = totalCentavos(lineas);
    if (total === null) errores.detalles = [mensajes.importe];
    else if (registrar && total <= BigInt(0))
      errores.detalles = [mensajes.totalPositivo];
  }
  return errores;
}
