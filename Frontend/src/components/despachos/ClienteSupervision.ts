import { api, ApiError } from "@/lib/api";
import { leerSupervision, type EstadoSupervision } from "./tiposSupervision";

export class ClienteSupervision {
  private estado: EstadoSupervision = { fase: "inactivo", datos: null };
  private escuchas = new Set<() => void>();
  private conexion: WebSocket | null = null;
  private controlador: AbortController | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private limite: ReturnType<typeof setTimeout> | null = null;
  private generacion = 0;
  private intentos = 0;
  private invalidado = false;
  constructor(
    private readonly despacho: number,
    private readonly solicitar = api,
    private readonly abrir = (url: string) => new WebSocket(url),
    private readonly obtenerOrigen = () => window.location.origin,
  ) {}
  obtenerEstado = () => this.estado;
  suscribir = (escucha: () => void) => {
    this.escuchas.add(escucha);
    return () => {
      this.escuchas.delete(escucha);
    };
  };
  private publicar(cambios: Partial<EstadoSupervision>) {
    this.estado = { ...this.estado, ...cambios };
    this.escuchas.forEach((escucha) => escucha());
  }
  detener = () => {
    ++this.generacion;
    this.controlador?.abort();
    this.controlador = null;
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.limite) clearTimeout(this.limite);
    this.temporizador = null;
    this.limite = null;
    if (this.conexion) {
      this.conexion.onclose = null;
      this.conexion.close();
      this.conexion = null;
    }
    this.publicar({ fase: "inactivo" });
  };
  invalidar = () => {
    this.detener();
    this.invalidado = true;
    this.publicar({ fase: "sin_permiso", datos: null });
  };
  iniciar = () => {
    if (this.invalidado) return;
    this.detener();
    this.intentos = 0;
    void this.conectar(this.generacion);
  };
  private reintentar(generacion: number) {
    if (generacion !== this.generacion || this.invalidado) return;
    if (++this.intentos > 5) {
      this.publicar({ fase: "sin_conexion" });
      return;
    }
    this.publicar({ fase: "reconectando" });
    this.temporizador = setTimeout(
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
    const esperaHttp = setTimeout(() => controlador.abort(), 10000);
    try {
      const acceso = await this.solicitar<{
        despacho: number;
        acceso: string;
        websocket: string;
      }>(`despachos/${this.despacho}/acceso-supervision/`, {
        method: "POST",
        body: "{}",
        signal: controlador.signal,
      });
      if (generacion !== this.generacion || controlador.signal.aborted) return;
      if (
        acceso.despacho !== this.despacho ||
        !/^[A-Za-z0-9_-]{43}$/.test(acceso.acceso) ||
        acceso.websocket !== `/ws/seguimiento/${this.despacho}/`
      )
        throw new Error("Acceso no válido");
      const url = new URL(acceso.websocket, this.obtenerOrigen());
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const conexion = this.abrir(url.toString());
      this.conexion = conexion;
      this.limite = setTimeout(() => conexion.close(), 10000);
      conexion.onopen = () => {
        if (generacion === this.generacion)
          conexion.send(
            JSON.stringify({ tipo: "autorizar", acceso: acceso.acceso }),
          );
        else conexion.close();
      };
      conexion.onmessage = (evento) => {
        if (generacion !== this.generacion) return;
        try {
          const mensaje = JSON.parse(String(evento.data));
          if (mensaje.tipo !== "seguimiento")
            throw new Error("Mensaje no válido");
          const datos = leerSupervision(mensaje.datos, this.despacho);
          const anterior = this.estado.datos;
          if (
            anterior &&
            Date.parse(datos.consultadoEn) < Date.parse(anterior.consultadoEn)
          )
            return;
          if (
            anterior?.seguimiento?.id === datos.seguimiento?.id &&
            anterior?.seguimiento?.posicion &&
            datos.seguimiento?.posicion &&
            Date.parse(datos.seguimiento.posicion.capturadaEn) <
              Date.parse(anterior.seguimiento.posicion.capturadaEn)
          )
            return;
          if (this.limite) clearTimeout(this.limite);
          this.limite = setTimeout(() => conexion.close(), 25000);
          this.intentos = 0;
          this.publicar({
            fase: "en_vivo",
            datos,
            desfaseReloj: Date.parse(datos.consultadoEn) - Date.now(),
          });
        } catch {
          conexion.close();
        }
      };
      conexion.onerror = () => conexion.close();
      conexion.onclose = (evento) => {
        if (generacion !== this.generacion) return;
        this.conexion = null;
        if (this.limite) clearTimeout(this.limite);
        this.limite = null;
        if ([4401, 4403].includes(evento.code)) {
          this.invalidar();
          return;
        }
        this.reintentar(generacion);
      };
    } catch (error) {
      if (generacion !== this.generacion) return;
      if (error instanceof ApiError && [401, 403, 404].includes(error.status))
        this.invalidar();
      else this.reintentar(generacion);
    } finally {
      clearTimeout(esperaHttp);
    }
  }
}
