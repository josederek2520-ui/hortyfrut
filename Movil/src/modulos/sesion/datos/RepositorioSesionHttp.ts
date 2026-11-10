import type { ClienteApi } from "@/infraestructura/api/ClienteApi";
import type { AlmacenSeguro } from "@/infraestructura/seguridad/AlmacenSeguro";
import type {
  RepositorioSesion,
  Sesion,
  UsuarioSesion,
} from "../dominio/Sesion";
import { ErrorAplicacion } from "@/compartido/dominio/Errores";

export class RepositorioSesionHttp implements RepositorioSesion {
  private generacion = 0;
  constructor(
    private readonly cliente: ClienteApi,
    private readonly almacen: AlmacenSeguro,
    private readonly uuid: () => string,
  ) {}
  async restaurar(): Promise<Sesion | null> {
    const generacion = this.generacion;
    const sesion = await this.almacen.sesion();
    if (generacion !== this.generacion) return null;
    if (!sesion) return null;
    if (
      sesion.servidor !== this.cliente.servidor ||
      Date.parse(sesion.venceEn) <= Date.now()
    ) {
      await this.eliminarLocal();
      return null;
    }
    try {
      const actual = await this.cliente.solicitar<{
        usuario: UsuarioSesion;
        vence_en: string;
        puede_operar: boolean;
      }>("movil/sesion/", { credencial: sesion.credencial });
      if (generacion !== this.generacion) return null;
      if (actual.usuario.id !== sesion.usuario.id)
        throw new ErrorAplicacion("sesion", 401);
      const vigente = {
        ...sesion,
        usuario: actual.usuario,
        venceEn: actual.vence_en,
        puedeOperar: actual.puede_operar,
      };
      await this.almacen.guardar("hortyfru.sesion", JSON.stringify(vigente));
      return vigente;
    } catch (error) {
      if (
        error instanceof ErrorAplicacion &&
        [401, 403].includes(error.estado)
      ) {
        if (generacion === this.generacion) await this.eliminarLocal();
        return null;
      }
      throw error;
    }
  }
  async ingresar(correo: string, contrasena: string): Promise<Sesion> {
    const generacion = ++this.generacion;
    let dispositivo = await this.almacen.leer("hortyfru.dispositivo");
    if (!dispositivo) {
      dispositivo = this.uuid();
      await this.almacen.guardar("hortyfru.dispositivo", dispositivo);
    }
    const respuesta = await this.cliente.solicitar<{
      usuario: UsuarioSesion;
      credencial: string;
      vence_en: string;
    }>("movil/iniciar-sesion/", {
      metodo: "POST",
      credencial: null,
      cuerpo: {
        email: correo,
        password: contrasena,
        identificador_dispositivo: dispositivo,
        nombre_dispositivo: "HortyFru Chofer",
      },
    });
    const actual = await this.cliente.solicitar<{ puede_operar: boolean }>(
      "movil/sesion/",
      { credencial: respuesta.credencial },
    );
    if (generacion !== this.generacion)
      throw new ErrorAplicacion("sesion", 401);
    const sesion: Sesion = {
      usuario: respuesta.usuario,
      credencial: respuesta.credencial,
      venceEn: respuesta.vence_en,
      puedeOperar: actual.puede_operar,
      servidor: this.cliente.servidor,
    };
    await this.almacen.guardar("hortyfru.sesion", JSON.stringify(sesion));
    return sesion;
  }
  async cerrar() {
    ++this.generacion;
    await this.cliente.solicitar("movil/sesion/", { metodo: "POST" });
  }
  async eliminarLocal() {
    ++this.generacion;
    await this.almacen.eliminar("hortyfru.sesion");
  }
}
