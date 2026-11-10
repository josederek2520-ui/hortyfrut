import type { EstadoSonido } from "./tipos";

function obtenerAlmacenamiento() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export class SonidoChat {
  private audio: HTMLAudioElement | null = null;
  private ultimo = 0;
  private vigente = true;
  constructor(
    private readonly usuario: number,
    private readonly alCambiar: (estado: EstadoSonido) => void,
    private readonly crearAudio = () =>
      new Audio("/sonidos/notificacion-chat.mp3"),
    private readonly almacenamiento: Pick<
      Storage,
      "getItem" | "setItem"
    > | null = obtenerAlmacenamiento(),
    private readonly exclusivo = (
      nombre: string,
      accion: () => Promise<void>,
    ) =>
      typeof navigator !== "undefined" && navigator.locks
        ? navigator.locks.request(nombre, accion)
        : accion(),
  ) {}
  private clave() {
    return `hortyfru-chat-sonido-${this.usuario}`;
  }
  private leer(clave: string) {
    try {
      return this.almacenamiento?.getItem(clave) ?? null;
    } catch {
      return null;
    }
  }
  private guardar(clave: string, valor: string) {
    try {
      this.almacenamiento?.setItem(clave, valor);
    } catch {
      /* La preferencia en memoria sigue disponible. */
    }
  }
  private silenciado = false;
  estadoInicial(): EstadoSonido {
    this.silenciado = this.leer(this.clave()) === "no";
    return this.silenciado ? "silenciado" : "pendiente";
  }
  private obtenerAudio() {
    if (!this.audio) {
      this.audio = this.crearAudio();
      this.audio.preload = "auto";
      this.audio.volume = 0.6;
    }
    return this.audio;
  }
  async activar() {
    if (!this.vigente) return;
    this.silenciado = false;
    this.guardar(this.clave(), "si");
    try {
      const audio = this.obtenerAudio();
      audio.currentTime = 0;
      await audio.play();
      if (this.vigente) this.alCambiar("activo");
    } catch {
      if (this.vigente) this.alCambiar("pendiente");
    }
  }
  silenciar() {
    this.silenciado = true;
    this.guardar(this.clave(), "no");
    this.audio?.pause();
    this.alCambiar("silenciado");
  }
  async avisar(identificador: number) {
    if (!this.vigente || identificador <= this.ultimo) return;
    this.ultimo = identificador;
    if (this.silenciado || this.leer(this.clave()) === "no") return;
    try {
      await this.exclusivo(`hortyfru-chat-aviso-${this.usuario}`, async () => {
        if (
          !this.vigente ||
          Number(this.leer(this.clave() + "-ultimo") ?? 0) >= identificador
        )
          return;
        try {
          const audio = this.obtenerAudio();
          audio.currentTime = 0;
          await audio.play();
          if (this.vigente) {
            this.guardar(this.clave() + "-ultimo", String(identificador));
            this.alCambiar("activo");
          } else audio.pause();
        } catch {
          if (this.vigente) this.alCambiar("pendiente");
        }
      });
    } catch {
      if (this.vigente) this.alCambiar("pendiente");
    }
  }
  cerrar() {
    this.vigente = false;
    this.audio?.pause();
    this.audio = null;
  }
}
