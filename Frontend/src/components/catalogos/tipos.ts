export type TipoCatalogo = "unidades_medida" | "categorias_productos";
export type TipoListado = TipoCatalogo | "productos";
export interface PermisosCatalogo {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  cambiar_estado: boolean;
}
export interface RegistroCatalogo {
  id: number;
  nombre: string;
  abreviatura?: string;
  activo: boolean;
  creado_en: string;
  version: string;
  categoria?: { id: number; nombre: string; activo: boolean };
  unidad_medida?: {
    id: number;
    nombre: string;
    abreviatura?: string;
    activo: boolean;
  };
  imagen?: string | null;
}
export interface PaginaCatalogo {
  count: number;
  results: RegistroCatalogo[];
}
export interface ResumenCatalogo {
  total: number;
  activos: number;
  inactivos: number;
}
export const CONFIGURACION_CATALOGOS = {
  unidades_medida: { ruta: "unidades-medida", conAbreviatura: true },
  categorias_productos: { ruta: "categorias-productos", conAbreviatura: false },
  productos: { ruta: "productos", conAbreviatura: false },
} as const;
