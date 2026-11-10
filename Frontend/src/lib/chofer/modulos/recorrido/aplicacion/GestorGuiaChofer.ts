import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
import type {
  ContextoGuia,
  DocumentoGuia,
  EstadoGuia,
  LineaGuia,
  RepositorioGuia,
} from "../dominio/GuiaChofer";
import {
  posicionValidaGuia,
  recortarGuia,
  distanciaGuia,
} from "./geometriaGuia";

const vacio = (): EstadoGuia => ({
  clave: null,
  fase: "inactiva",
  tramo: null,
  geometria: null,
  distanciaM: null,
});
export class GestorGuiaChofer {
  private estado: EstadoGuia = vacio();
  private escuchas = new Set<() => void>();
  private contexto: ContextoGuia | null = null;
  private controlador: AbortController | null = null;
  private consulta: { documento: DocumentoGuia; creada: number } | null = null;
  private camino: LineaGuia | null = null;
  private avance: number | undefined;
  private ultimaLectura: string | null = null;
  private desvios = 0;
  private proximaConsulta = 0;
  private recalculada = false;
  constructor(
    private readonly repositorio: RepositorioGuia,
    private readonly crearClave: () => string,
    private readonly ahora = Date.now,
  ) {}
  obtenerEstado = () => this.estado;
  suscribir = (escucha: () => void) => {
    this.escuchas.add(escucha);
    return () => {
      this.escuchas.delete(escucha);
    };
  };
  private publicar(cambios: Partial<EstadoGuia>) {
    this.estado = { ...this.estado, ...cambios };
    this.escuchas.forEach((e) => e());
  }
  limpiar = () => {
    this.controlador?.abort();
    this.controlador = null;
    this.contexto = null;
    this.consulta = null;
    this.camino = null;
    this.avance = undefined;
    this.ultimaLectura = null;
    this.desvios = 0;
    this.proximaConsulta = 0;
    this.recalculada = false;
    this.estado = vacio();
    this.escuchas.forEach((e) => e());
  };
  actualizar = (contexto: ContextoGuia | null) => {
    if (!contexto || !posicionValidaGuia(contexto.posicion, this.ahora())) {
      if (this.contexto) this.limpiar();
      return;
    }
    if (this.contexto?.clave !== contexto.clave) {
      this.limpiar();
      this.contexto = contexto;
      this.camino = contexto.objetivo.geometria;
      this.publicar({ clave: contexto.clave, tramo: contexto.objetivo.tramo });
    } else {
      if (this.contexto.version !== contexto.version) {
        // Llegada o descarga parcial no cambian el camino hacia este destino.
        // Una consulta pendiente sí debe usar la nueva versión del despacho.
        this.controlador?.abort();
        this.controlador = null;
        this.consulta = null;
      }
      this.contexto = contexto;
    }
    if (this.ultimaLectura !== contexto.posicion.id) {
      this.ultimaLectura = contexto.posicion.id;
      const recorte = this.camino
        ? recortarGuia(
            this.camino,
            [contexto.posicion.longitud, contexto.posicion.latitud],
            contexto.posicion.precisionM,
            this.avance,
          )
        : null;
      if (recorte) {
        this.desvios = 0;
        this.avance = recorte.avance;
        this.publicar({
          fase: this.recalculada ? "actualizada" : "recorrido",
          geometria: recorte.geometria,
          distanciaM: recorte.distanciaM,
        });
        return;
      }
      this.desvios++;
      this.publicar({ geometria: null, distanciaM: null });
    }
    if (this.controlador) return;
    if (this.consulta && this.ahora() - this.consulta.creada > 90000)
      this.consulta = null;
    if (this.ahora() < this.proximaConsulta) {
      if (this.estado.fase === "sin_guia") {
        const esperaS = Math.ceil((this.proximaConsulta - this.ahora()) / 1000);
        if (this.estado.esperaS !== esperaS) this.publicar({ esperaS });
      }
      return;
    }
    if (!this.consulta && this.camino && this.desvios < 2) return;
    if (!this.consulta) {
      this.consulta = {
        creada: this.ahora(),
        documento: {
          clave_operacion: this.crearClave(),
          version: contexto.version,
          sesion: contexto.sesion,
          plan: contexto.objetivo.plan,
          tramo: contexto.objetivo.tramo,
          posicion: {
            id: contexto.posicion.id,
            latitud: contexto.posicion.latitud.toFixed(7),
            longitud: contexto.posicion.longitud.toFixed(7),
            precision_m: contexto.posicion.precisionM.toFixed(2),
            capturada_en: contexto.posicion.capturadaEn,
          },
        },
      };
    }
    void this.solicitar(contexto, this.consulta);
  };
  tic = () => {
    this.actualizar(this.contexto);
  };
  reintentar = () => {
    this.actualizar(this.contexto);
  };
  private async solicitar(
    contexto: ContextoGuia,
    consulta: NonNullable<GestorGuiaChofer["consulta"]>,
  ) {
    const controlador = new AbortController();
    this.controlador = controlador;
    this.publicar({ fase: "calculando", esperaS: 0 });
    // La espera pertenece a esta sesión/objetivo y se cuenta tras la respuesta.
    try {
      const respuesta = await this.repositorio.consultar(
        contexto.viaje,
        consulta.documento,
        controlador.signal,
      );
      const actual = this.contexto;
      if (
        controlador.signal.aborted ||
        actual?.clave !== contexto.clave ||
        !posicionValidaGuia(actual.posicion, this.ahora())
      )
        return;
      if (respuesta.estado === "pendiente") {
        this.proximaConsulta = this.ahora() + 5000;
        return;
      }
      this.consulta = null;
      this.proximaConsulta = this.ahora() + 30000;
      const geometria = respuesta.geometria;
      const destino = actual.objetivo.destino.posicion!;
      if (
        respuesta.estado === "lista" &&
        geometria &&
        Date.parse(respuesta.venceEn) > this.ahora() &&
        distanciaGuia(geometria.coordinates.at(-1)!, destino) <= 250
      ) {
        const recorte = recortarGuia(
          geometria,
          [actual.posicion.longitud, actual.posicion.latitud],
          actual.posicion.precisionM,
        );
        if (recorte) {
          this.camino = geometria;
          this.recalculada = true;
          this.avance = recorte.avance;
          this.desvios = 0;
          this.publicar({
            fase: "actualizada",
            geometria: recorte.geometria,
            distanciaM: recorte.distanciaM,
          });
          return;
        }
      }
      this.publicar({
        fase: "sin_guia",
        geometria: null,
        distanciaM: null,
        esperaS: 30,
      });
    } catch (error) {
      if (controlador.signal.aborted || this.contexto?.clave !== contexto.clave)
        return;
      if (
        error instanceof ErrorAplicacion &&
        [400, 401, 403, 404, 409, 429].includes(error.estado)
      )
        this.consulta = null;
      this.proximaConsulta = this.ahora() + 30000;
      this.publicar({
        fase: "sin_guia",
        geometria: null,
        distanciaM: null,
        esperaS: 30,
      });
    } finally {
      if (this.controlador === controlador) this.controlador = null;
    }
  }
}
