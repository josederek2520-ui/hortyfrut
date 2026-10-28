export interface RegistroComercial {
  id: number;
  telefono: string;
  activo: boolean;
  creado_en: string;
  version: string;
}
export interface Cliente extends RegistroComercial {
  razon_social: string;
  nit: string;
  email: string;
  cantidad_sucursales: number;
}
export interface Sucursal extends RegistroComercial {
  encargado_pedidos: { id: number; nombre: string; activo: boolean } | null;
  cliente: number;
  nombre: string;
  direccion: string;
  referencia: string;
  latitud: string | null;
  longitud: string | null;
}
export type RegistroDirectorio = Cliente | Sucursal;
export type TipoDirectorio = "clientes" | "sucursales";
export interface PaginaDirectorio {
  count: number;
  results: RegistroDirectorio[];
}
export interface ResumenDirectorio {
  total: number;
  activos: number;
  inactivos: number;
}
export function nombreRegistro(registro: RegistroDirectorio): string {
  return "razon_social" in registro ? registro.razon_social : registro.nombre;
}
