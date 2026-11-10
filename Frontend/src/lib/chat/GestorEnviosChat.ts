import { api, ApiError } from "@/lib/api";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import type { MensajeChat } from "./tipos";
export interface EnvioChat {
  documento: Readonly<{ clave_cliente: string; texto: string }>;
  fase: "enviando" | "pendiente";
}
export class GestorEnviosChat {
  private pendientes: ReadonlyMap<number, EnvioChat> = new Map();
  private escuchas = new Set<() => void>();
  private controladores = new Map<number, AbortController>();
  private generacion = 0;
  constructor(
    private readonly solicitar = api,
    private readonly crearClave = crearClaveOperacion,
    private readonly usuario?: number,
  ) {}
  obtenerEstado = () => this.pendientes;
  suscribir = (escucha: () => void) => {
    this.escuchas.add(escucha);
    return () => {
      this.escuchas.delete(escucha);
    };
  };
  private cambiar(identificador: number, envio: EnvioChat | null) {
    const nuevos = new Map(this.pendientes);
    if (envio) nuevos.set(identificador, envio);
    else nuevos.delete(identificador);
    this.pendientes = nuevos;
    this.escuchas.forEach((escucha) => escucha());
  }
  enviar = (identificador: number, texto: string) => {
    if (this.pendientes.has(identificador))
      return Promise.reject(new Error("Hay un envio por comprobar"));
    const limpio = texto.trim();
    if (!limpio || limpio.length > 2000)
      return Promise.reject(new Error("Mensaje no valido"));
    const documento = Object.freeze({
      clave_cliente: this.crearClave(),
      texto: limpio,
    });
    this.cambiar(identificador, { documento, fase: "pendiente" });
    return this.reintentar(identificador);
  };
  reintentar = async (identificador: number) => {
    const envio = this.pendientes.get(identificador);
    if (!envio || this.controladores.has(identificador))
      throw new Error("Envio no disponible");
    const generacion = this.generacion,
      controlador = new AbortController();
    this.controladores.set(identificador, controlador);
    this.cambiar(identificador, { ...envio, fase: "enviando" });
    const limite = setTimeout(() => controlador.abort(), 15000);
    try {
      const mensaje = await this.solicitar<MensajeChat>(
        `chat/conversaciones/${identificador}/mensajes/`,
        {
          method: "POST",
          body: JSON.stringify(envio.documento),
          signal: controlador.signal,
          headers: this.usuario
            ? { "X-Usuario-Chat": String(this.usuario) }
            : undefined,
        },
      );
      if (generacion !== this.generacion) throw new Error("La cuenta cambio");
      if (
        mensaje.conversacion !== identificador ||
        mensaje.clave_cliente !== envio.documento.clave_cliente ||
        mensaje.texto !== envio.documento.texto
      )
        throw new Error("Acuse no valido");
      this.cambiar(identificador, null);
      return mensaje;
    } catch (error) {
      if (generacion === this.generacion)
        this.cambiar(
          identificador,
          error instanceof ApiError &&
            [400, 401, 403, 404, 409].includes(error.status)
            ? null
            : { ...envio, fase: "pendiente" },
        );
      throw error;
    } finally {
      clearTimeout(limite);
      if (generacion === this.generacion)
        this.controladores.delete(identificador);
    }
  };
  limpiar() {
    ++this.generacion;
    this.controladores.forEach((controlador) => controlador.abort());
    this.controladores.clear();
    this.pendientes = new Map();
    this.escuchas.forEach((escucha) => escucha());
  }
}
