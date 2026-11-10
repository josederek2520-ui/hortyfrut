import { api, ApiError } from "@/lib/api";
import { leerResumenChat, type EstadoChat, type ResumenChat } from "./tipos";
import { SonidoChat } from "./SonidoChat";
import { GestorEnviosChat } from "./GestorEnviosChat";
export class ClienteChat {
  private estado: EstadoChat = {
    fase: "inactivo",
    resumen: null,
    sonido: "pendiente",
  };
  private escuchas = new Set<() => void>();
  private canal: WebSocket | null = null;
  private controlador: AbortController | null = null;
  private reintento: ReturnType<typeof setTimeout> | null = null;
  private vigilancia: ReturnType<typeof setTimeout> | null = null;
  private generacion = 0;
  private intentos = 0;
  private ultimoRecibido = 0;
  readonly sonido: SonidoChat;
  readonly envios: GestorEnviosChat;
  constructor(
    readonly usuario: number,
    private readonly alMensaje: (
      aviso: NonNullable<ResumenChat["ultimo_recibido"]>,
    ) => void,
    private readonly solicitar = api,
    private readonly abrir = (url: string) => new WebSocket(url),
    private readonly origen = () => window.location.origin,
    crearSonido = (cambiar: (estado: EstadoChat["sonido"]) => void) =>
      new SonidoChat(usuario, cambiar),
  ) {
    this.envios = new GestorEnviosChat(solicitar, undefined, usuario);
    this.sonido = crearSonido((sonido) => this.publicar({ sonido }));
    this.estado.sonido = this.sonido.estadoInicial();
  }
  obtenerEstado = () => this.estado;
  suscribir = (escucha: () => void) => {
    this.escuchas.add(escucha);
    return () => {
      this.escuchas.delete(escucha);
    };
  };
  private publicar(cambio: Partial<EstadoChat>) {
    this.estado = { ...this.estado, ...cambio };
    this.escuchas.forEach((escucha) => escucha());
  }
  iniciar = () => {
    this.pararCanal();
    this.intentos = 0;
    void this.conectar(this.generacion);
  };
  private pararCanal() {
    ++this.generacion;
    this.controlador?.abort();
    this.controlador = null;
    if (this.reintento) clearTimeout(this.reintento);
    if (this.vigilancia) clearTimeout(this.vigilancia);
    this.reintento = null;
    this.vigilancia = null;
    if (this.canal) {
      this.canal.onclose = null;
      this.canal.close();
      this.canal = null;
    }
  }
  cerrar = () => {
    this.pararCanal();
    this.envios.limpiar();
    this.sonido.cerrar();
    this.publicar({ fase: "inactivo", resumen: null });
  };
  private volver(generacion: number) {
    if (generacion !== this.generacion) return;
    if (++this.intentos > 5) {
      this.publicar({ fase: "sin_conexion" });
      return;
    }
    this.publicar({ fase: "reconectando" });
    this.reintento = setTimeout(
      () => {
        void this.conectar(generacion);
      },
      Math.min(16000, 1000 * 2 ** (this.intentos - 1)),
    );
  }
  private async conectar(generacion: number) {
    if (generacion !== this.generacion) return;
    this.publicar({ fase: this.intentos ? "reconectando" : "conectando" });
    const controlador = new AbortController();
    this.controlador = controlador;
    const limite = setTimeout(() => controlador.abort(), 10000);
    try {
      const acceso = await this.solicitar<{
        usuario: number;
        acceso: string;
        websocket: string;
      }>("chat/acceso/", {
        method: "POST",
        body: "{}",
        signal: controlador.signal,
        headers: { "X-Usuario-Chat": String(this.usuario) },
      });
      if (generacion !== this.generacion || controlador.signal.aborted) return;
      if (
        acceso.usuario !== this.usuario ||
        acceso.websocket !== "/ws/chat/" ||
        !/^[A-Za-z0-9_-]{43}$/.test(acceso.acceso)
      )
        throw new Error("Acceso no valido");
      const url = new URL(acceso.websocket, this.origen());
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const canal = this.abrir(url.toString());
      this.canal = canal;
      this.vigilancia = setTimeout(() => canal.close(), 10000);
      canal.onopen = () => {
        if (generacion === this.generacion)
          canal.send(
            JSON.stringify({ tipo: "autorizar", acceso: acceso.acceso }),
          );
        else canal.close();
      };
      canal.onmessage = (evento) => {
        if (generacion !== this.generacion) return;
        try {
          const mensaje = JSON.parse(String(evento.data));
          if (mensaje.tipo !== "estado" || typeof mensaje.inicial !== "boolean")
            throw new Error("Aviso no valido");
          const resumen = leerResumenChat(mensaje.datos, this.usuario);
          if (this.vigilancia) clearTimeout(this.vigilancia);
          this.vigilancia = setTimeout(() => canal.close(), 40000);
          if (
            this.estado.resumen &&
            resumen.revision < this.estado.resumen.revision
          )
            return;
          const anterior = this.ultimoRecibido;
          this.ultimoRecibido = Math.max(
            anterior,
            resumen.ultimo_recibido?.id ?? 0,
          );
          this.intentos = 0;
          this.publicar({ fase: "en_vivo", resumen });
          if (
            !mensaje.inicial &&
            resumen.ultimo_recibido &&
            resumen.ultimo_recibido.id > anterior
          ) {
            this.alMensaje(resumen.ultimo_recibido);
            void this.sonido.avisar(resumen.ultimo_recibido.id);
          }
        } catch {
          canal.close();
        }
      };
      canal.onerror = () => canal.close();
      canal.onclose = (evento) => {
        if (generacion !== this.generacion) return;
        this.canal = null;
        if (this.vigilancia) clearTimeout(this.vigilancia);
        this.vigilancia = null;
        if ([4401, 4403].includes(evento.code)) {
          this.envios.limpiar();
          this.publicar({ fase: "acceso_terminado", resumen: null });
          return;
        }
        this.volver(generacion);
      };
    } catch (error) {
      if (generacion !== this.generacion) return;
      if (error instanceof ApiError && [401, 403].includes(error.status))
        this.publicar({ fase: "acceso_terminado", resumen: null });
      else this.volver(generacion);
    } finally {
      clearTimeout(limite);
    }
  }
}
