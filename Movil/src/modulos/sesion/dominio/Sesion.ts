export interface UsuarioSesion {
  id: number;
  nombre: string;
}
export interface Sesion {
  usuario: UsuarioSesion;
  credencial: string;
  venceEn: string;
  puedeOperar: boolean;
  servidor: string;
}
export interface RepositorioSesion {
  restaurar(): Promise<Sesion | null>;
  ingresar(correo: string, contrasena: string): Promise<Sesion>;
  cerrar(): Promise<void>;
  eliminarLocal(): Promise<void>;
}
export type EstadoSesion =
  | { fase: "iniciando" | "anonima" | "error"; sesion: null }
  | { fase: "autenticada"; sesion: Sesion };
