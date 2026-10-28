export interface Permission {
  id: number;
  code: string;
  label: string;
  module: string;
  asignable: boolean;
}
export interface PermissionModule {
  key: string;
  label: string;
  permissions: Permission[];
}
export interface RoleRow {
  id: number;
  name: string;
  usuarios_count: number;
  permisos_count: number;
  gestion: { edit: boolean; delete: boolean; reason: string };
  version: string;
}
export interface RoleDetail extends RoleRow {
  permissions: Permission[];
  actividad_reciente: {
    id: number;
    accion: string;
    fecha: string;
    actor: string | null;
  }[];
}
export interface RolePage {
  count: number;
  results: RoleRow[];
}
export interface RoleStats {
  total: number;
  asignados: number;
  sin_usuarios: number;
}
