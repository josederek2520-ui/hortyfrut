import type { RegistroCatalogo } from "@/components/catalogos/tipos";

export interface OpcionCatalogo {
  id: number;
  nombre: string;
  activo: boolean;
  abreviatura?: string;
}
export interface Producto extends RegistroCatalogo {
  categoria: OpcionCatalogo;
  unidad_medida: OpcionCatalogo;
  imagen: string | null;
}

export type UsoPresentacion = "compra" | "pedido" | "ambos";
export interface Presentacion {
  id: number;
  producto: number;
  nombre: string;
  uso: UsoPresentacion;
  columna_pedido: "otra" | "cajas" | "unidades";
  activo: boolean;
  creado_en: string;
  version: string;
}
export interface PaginaPresentaciones {
  count: number;
  results: Presentacion[];
}
