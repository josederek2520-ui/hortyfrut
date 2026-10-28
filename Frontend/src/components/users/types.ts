import type {
  PermisosCatalogo,
  TipoCatalogo,
} from "@/components/catalogos/tipos";
export interface Role {
  id: number;
  name: string;
  asignable: boolean;
}
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  nombre_completo: string;
  email: string;
  cedula_identidad: string;
  celular: string;
  is_active: boolean;
  roles: Role[];
  date_joined: string;
  last_login: string | null;
  protegido: boolean;
}
export interface UserDetail extends User {
  fecha_nacimiento: string | null;
  direccion: string;
  actividad_reciente: {
    id: number;
    actor: string | null;
    accion: string;
    campos: string[];
    fecha: string;
  }[];
}
export interface Capabilities {
  view: boolean;
  create: boolean;
  edit: boolean;
  change_status: boolean;
  assign_roles: boolean;
  reset_password: boolean;
}
export interface Session {
  permisos_preparaciones: import("@/components/preparaciones/tipos").PermisosPreparaciones;
  permisos_cajillas: import("@/components/cajillas/tipos").PermisosCajillas;
  permisos_recepciones: import("@/components/recepciones/tipos").PermisosRecepciones;
  permisos_inventario: import("@/components/inventario/tipos").PermisosInventario;
  permisos_almacenes: PermisosCatalogo;
  permisos_compras: import("@/components/compras/tipos").PermisosCompras;
  permisos_proveedores: PermisosCatalogo;
  permisos_pedidos: import("@/components/pedidos/tipos").PermisosPedidos;
  puede_asignar_encargado: boolean;
  permisos_clientes: PermisosCatalogo;
  permisos_sucursales: PermisosCatalogo;
  permisos_presentaciones: PermisosCatalogo;
  permisos_productos: PermisosCatalogo;
  permisos_catalogos: Record<TipoCatalogo, PermisosCatalogo>;
  permisos_actividad: { ver: boolean };
  user: User;
  capabilities: Capabilities;
  role_capabilities: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}
export interface PaginatedUsers {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}
export interface UserStats {
  total: number;
  activos: number;
  inactivos: number;
}
export interface UserPayload {
  first_name: string;
  last_name: string;
  email: string;
  cedula_identidad: string;
  fecha_nacimiento: string | null;
  celular: string;
  direccion: string;
  password?: string;
  roles?: number[];
}
