import type { EstadoSesion, RepositorioSesion } from "../dominio/Sesion";

export class ServicioSesion {
  private estado: EstadoSesion = { fase: "iniciando", sesion: null };
  private escuchas = new Set<() => void>();
  private restauracion: Promise<void> | null = null;
  private limpieza: Promise<void> | null = null;
  private generacion = 0;
  constructor(
    private readonly repositorio: RepositorioSesion,
    private readonly alCambiarCuenta: () => void,
    private readonly alCerrarSesion: () => void = () => {},
  ) {}
  obtenerEstado = () => this.estado;
  suscribir = (escucha: () => void) => {
    this.escuchas.add(escucha);
    return () => {
      this.escuchas.delete(escucha);
    };
  };
  private establecer(estado: EstadoSesion) {
    this.estado = estado;
    this.escuchas.forEach((escucha) => escucha());
  }
  restaurar = (): Promise<void> => {
    if (this.limpieza) return this.limpieza;
    if (this.restauracion) return this.restauracion;
    const generacion = this.generacion;
    this.restauracion = (async () => {
      try {
        const sesion = await this.repositorio.restaurar();
        if (generacion === this.generacion)
          this.establecer(
            sesion
              ? { fase: "autenticada", sesion }
              : { fase: "anonima", sesion: null },
          );
      } catch {
        if (generacion === this.generacion)
          this.establecer({ fase: "error", sesion: null });
      } finally {
        this.restauracion = null;
      }
    })();
    return this.restauracion;
  };
  ingresar = async (correo: string, contrasena: string) => {
    await this.limpieza;
    const generacion = ++this.generacion;
    const sesion = await this.repositorio.ingresar(correo.trim(), contrasena);
    if (generacion !== this.generacion) return;
    this.alCambiarCuenta();
    this.establecer({ fase: "autenticada", sesion });
  };
  cerrar = async () => {
    ++this.generacion;
    this.alCerrarSesion();
    await this.repositorio.cerrar();
    await this.expirar();
  };
  expirar = (): Promise<void> => {
    if (this.limpieza) return this.limpieza;
    const generacion = ++this.generacion;
    this.alCambiarCuenta();
    this.establecer({ fase: "iniciando", sesion: null });
    this.limpieza = (async () => {
      try {
        await this.repositorio.eliminarLocal();
        if (generacion === this.generacion)
          this.establecer({ fase: "anonima", sesion: null });
      } catch (error) {
        if (generacion === this.generacion)
          this.establecer({ fase: "error", sesion: null });
        throw error;
      } finally {
        this.limpieza = null;
      }
    })();
    return this.limpieza;
  };
}
