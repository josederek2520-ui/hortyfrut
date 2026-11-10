export interface UsuarioChat {
  id: number;
  nombre: string;
  activo: boolean;
}
export interface MensajeChat {
  id: number;
  conversacion: number;
  autor: number;
  clave_cliente: string;
  texto: string;
  creado_en: string;
  leido_en: string | null;
}
export interface ConversacionChat {
  id: number;
  usuario: UsuarioChat;
  actualizada_en: string;
  ultimo_mensaje: MensajeChat | null;
  no_leidos: number;
}
export interface PaginaChat<T> {
  count: number;
  results: T[];
  next: string | null;
  previous: string | null;
}
export interface PaginaMensajes extends PaginaChat<MensajeChat> {
  corte: number;
  conversacion: ConversacionChat;
}
export interface ResumenChat {
  usuario: number;
  revision: number;
  no_leidos: number;
  ultimo_recibido: null | {
    id: number;
    conversacion: number;
    autor: { id: number; nombre: string };
    creado_en: string;
  };
}
export type FaseChat =
  | "inactivo"
  | "conectando"
  | "en_vivo"
  | "reconectando"
  | "sin_conexion"
  | "acceso_terminado";
export type EstadoSonido = "pendiente" | "activo" | "silenciado";
export interface EstadoChat {
  fase: FaseChat;
  resumen: ResumenChat | null;
  sonido: EstadoSonido;
}

export function leerResumenChat(valor: unknown, usuario: number): ResumenChat {
  if (!valor || typeof valor !== "object")
    throw new Error("Respuesta de chat no valida");
  const datos = valor as ResumenChat;
  const entero = (numero: unknown) =>
    typeof numero === "number" && Number.isSafeInteger(numero) && numero >= 0;
  if (
    datos.usuario !== usuario ||
    !entero(datos.revision) ||
    !entero(datos.no_leidos)
  )
    throw new Error("Buzon no valido");
  const ultimo = datos.ultimo_recibido;
  if (
    ultimo !== null &&
    (!ultimo ||
      !entero(ultimo.id) ||
      !entero(ultimo.conversacion) ||
      !ultimo.autor ||
      !entero(ultimo.autor.id) ||
      ultimo.autor.id === usuario ||
      typeof ultimo.autor.nombre !== "string" ||
      !Number.isFinite(Date.parse(ultimo.creado_en)))
  )
    throw new Error("Aviso no valido");
  return datos;
}
