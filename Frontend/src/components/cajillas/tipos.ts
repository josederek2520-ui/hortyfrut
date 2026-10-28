import type { OpcionCompra } from "@/components/compras/tipos";
export type TipoMovimientoCajilla = "ingreso" | "salida" | "devolucion";
export interface PermisosCajillas {
  ver: boolean;
  crear: boolean;
  ingresar: boolean;
  enviar: boolean;
  devolver: boolean;
}
export interface Cajilla {
  id: number;
  color: string;
  total: number;
  en_almacen: number;
  en_sucursales: number;
  creado_en: string;
  responsable_nombre: string;
  version: string;
}
export interface ResumenCajillas {
  total: number;
  en_almacen: number;
  en_sucursales: number;
  colores?: number;
}
export interface MovimientoCajilla {
  id: number;
  codigo: string;
  cajilla: number;
  color: string;
  tipo: TipoMovimientoCajilla | "inicial";
  cantidad: number;
  almacen: number;
  almacen_nombre: string;
  sucursal: number | null;
  sucursal_nombre: string;
  cliente_nombre: string;
  observaciones: string;
  responsable_nombre: string;
  creado_en: string;
}
export interface UbicacionCajillas extends OpcionCompra {
  activo?: boolean;
  cantidad?: number;
  pendiente?: number | null;
  cliente?: string;
}
export function puedeMoverCajillas(
  permisos: PermisosCajillas | undefined,
  tipo: TipoMovimientoCajilla,
) {
  return (
    !!permisos?.ver &&
    !!permisos[
      tipo === "ingreso"
        ? "ingresar"
        : tipo === "salida"
          ? "enviar"
          : "devolver"
    ]
  );
}
