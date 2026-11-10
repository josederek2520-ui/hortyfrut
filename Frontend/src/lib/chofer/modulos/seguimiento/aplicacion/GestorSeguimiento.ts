import {
  ErrorAplicacion,
  codigoError,
  resultadoIncierto,
} from "@/lib/chofer/compartido/dominio/Errores";
import type {
  CierreSeguimiento,
  EstadoSeguimiento,
  InicioSeguimiento,
  LecturaUbicacion,
  Localizador,
  LoteUbicaciones,
  MotivoCierre,
  PosicionChofer,
  RepositorioSeguimiento,
} from "../dominio/Seguimiento";

interface Contexto {
  viaje: number;
  inicio: InicioSeguimiento;
  inicioPendiente: boolean;
  autorizado: boolean;
  lecturaInicial: LecturaUbicacion | null;
  deseaCompartir: boolean;
  motivo: MotivoCierre;
  posiciones: PosicionChofer[];
  lote: LoteUbicaciones | null;
  cierre: CierreSeguimiento | null;
}

export class GestorSeguimiento {
  private estado: EstadoSeguimiento = {
    viaje: null,
    fase: "inactivo",
    posicion: null,
    error: "",
  };
  private escuchas = new Set<() => void>();
  private contexto: Contexto | null = null;
  private observacion: { remove(): void } | null = null;
  private trabajo: Promise<void> | null = null;
  private primerPlano = true;
  private ultimaCaptura = 0;
  constructor(
    private readonly repositorio: RepositorioSeguimiento,
    private readonly localizador: Localizador,
    private readonly crearClave: () => string,
    private readonly ahora = Date.now,
  ) {}
  obtenerEstado = () => this.estado;
  identificadorSesion = (viaje: number): string | null => {
    const contexto = this.contexto;
    return contexto?.viaje === viaje &&
      contexto.autorizado &&
      !contexto.inicioPendiente &&
      contexto.deseaCompartir &&
      this.primerPlano
      ? contexto.inicio.clave_operacion
      : null;
  };
  suscribir = (escucha: () => void) => {
    this.escuchas.add(escucha);
    return () => {
      this.escuchas.delete(escucha);
    };
  };
  private publicar(cambios: Partial<EstadoSeguimiento>) {
    this.estado = { ...this.estado, ...cambios };
    this.escuchas.forEach((escucha) => escucha());
  }
  private pararCaptura() {
    this.observacion?.remove();
    this.observacion = null;
  }
  iniciar = (viaje: number, version: string) => {
    if (this.contexto || this.trabajo)
      return Promise.reject(new ErrorAplicacion("ocupado"));
    if (!this.primerPlano)
      return Promise.reject(new ErrorAplicacion("gpsPrimerPlano"));
    this.ultimaCaptura = 0;
    this.contexto = {
      viaje,
      inicio: { clave_operacion: this.crearClave(), version },
      inicioPendiente: true,
      autorizado: false,
      lecturaInicial: null,
      deseaCompartir: true,
      motivo: "chofer",
      posiciones: [],
      lote: null,
      cierre: null,
    };
    this.publicar({ viaje, fase: "iniciando", posicion: null, error: "" });
    return this.procesar();
  };
  detener = (motivo: MotivoCierre = "chofer") => {
    this.pararCaptura();
    if (!this.contexto) return Promise.resolve();
    this.contexto.deseaCompartir = false;
    this.contexto.lecturaInicial = null;
    this.contexto.motivo = motivo;
    this.publicar({ fase: "pendiente", posicion: null, error: "" });
    return this.procesar();
  };
  reintentar = () => this.procesar();
  establecerPrimerPlano = (activo: boolean) => {
    this.primerPlano = activo;
    if (!activo) void this.detener("segundo_plano");
  };
  limpiar = () => {
    this.pararCaptura();
    this.contexto = null;
    this.trabajo = null;
    this.publicar({ viaje: null, fase: "inactivo", posicion: null, error: "" });
  };
  private terminar(contexto: Contexto, error = "") {
    if (this.contexto !== contexto) return;
    this.pararCaptura();
    this.contexto = null;
    this.publicar({
      fase: error ? "error" : "detenido",
      posicion: null,
      error,
    });
  }
  private recibir(contexto: Contexto, lectura: LecturaUbicacion) {
    if (
      this.contexto !== contexto ||
      !contexto.deseaCompartir ||
      !this.primerPlano
    )
      return;
    const numeros = [lectura.latitud, lectura.longitud, lectura.instante];
    if (
      !numeros.every(Number.isFinite) ||
      Math.abs(lectura.latitud) > 90 ||
      Math.abs(lectura.longitud) > 180 ||
      Math.abs(this.ahora() - lectura.instante) > 30000 ||
      lectura.instante <= this.ultimaCaptura
    )
      return;
    if (
      lectura.precisionM === null ||
      !Number.isFinite(lectura.precisionM) ||
      lectura.precisionM < 0 ||
      lectura.precisionM > 100
    ) {
      this.publicar({ error: "gpsPrecision" });
      return;
    }
    // El navegador decide cuándo entrega GPS; aceptar muestras nuevas como máximo cada 3 s.
    if (this.ultimaCaptura && lectura.instante - this.ultimaCaptura < 3000)
      return;
    this.ultimaCaptura = lectura.instante;
    const posicion: PosicionChofer = {
      id: this.crearClave(),
      latitud: lectura.latitud,
      longitud: lectura.longitud,
      precisionM: lectura.precisionM,
      capturadaEn: new Date(lectura.instante).toISOString(),
      velocidadMS:
        lectura.velocidadMS !== null &&
        Number.isFinite(lectura.velocidadMS) &&
        lectura.velocidadMS >= 0 &&
        lectura.velocidadMS <= 100
          ? lectura.velocidadMS
          : null,
      rumbo:
        lectura.rumbo !== null &&
        Number.isFinite(lectura.rumbo) &&
        lectura.rumbo >= 0 &&
        lectura.rumbo < 360
          ? lectura.rumbo
          : null,
    };
    if (contexto.posiciones.length >= 30) {
      void this.detener("sin_conexion");
      return;
    }
    contexto.posiciones.push(posicion);
    this.publicar({ fase: "compartiendo", posicion, error: "" });
    void this.procesar();
  }
  private prepararLote(contexto: Contexto) {
    if (contexto.lote || !contexto.posiciones.length) return;
    contexto.lote = {
      sesion: contexto.inicio.clave_operacion,
      clave_operacion: this.crearClave(),
      posiciones: contexto.posiciones.splice(0, 30).map((posicion) => ({
        id: posicion.id,
        latitud: posicion.latitud.toFixed(7),
        longitud: posicion.longitud.toFixed(7),
        precision_m: posicion.precisionM.toFixed(2),
        capturada_en: posicion.capturadaEn,
        velocidad_m_s: posicion.velocidadMS?.toFixed(2) ?? null,
        rumbo:
          posicion.rumbo === null
            ? null
            : Math.min(359.99, posicion.rumbo).toFixed(2),
      })),
    };
  }
  private procesar(): Promise<void> {
    if (this.trabajo) return this.trabajo;
    const contexto = this.contexto;
    if (!contexto) return Promise.resolve();
    const trabajo = this.ejecutar(contexto).finally(() => {
      if (this.trabajo === trabajo) this.trabajo = null;
    });
    this.trabajo = trabajo;
    return trabajo;
  }
  private async ejecutar(contexto: Contexto) {
    try {
      if (!contexto.autorizado) {
        const lecturaInicial = await this.localizador.autorizar();
        if (this.contexto !== contexto) return;
        contexto.autorizado = true;
        if (!contexto.deseaCompartir || !this.primerPlano) {
          this.terminar(contexto);
          return;
        }
        contexto.lecturaInicial = lecturaInicial ?? null;
      }
      if (contexto.inicioPendiente) {
        const sesion = await this.repositorio.iniciar(
          contexto.viaje,
          contexto.inicio,
        );
        if (this.contexto !== contexto) return;
        if (!sesion.activa || sesion.id !== contexto.inicio.clave_operacion) {
          this.terminar(contexto, "gpsSesionCerrada");
          return;
        }
        contexto.inicioPendiente = false;
      }
      while (this.contexto === contexto) {
        this.prepararLote(contexto);
        if (contexto.lote) {
          const sesion = await this.repositorio.enviar(
            contexto.viaje,
            contexto.lote,
          );
          if (this.contexto !== contexto) return;
          contexto.lote = null;
          if (!sesion.activa) {
            this.terminar(contexto, "gpsSesionCerrada");
            return;
          }
          continue;
        }
        if (!contexto.deseaCompartir || !this.primerPlano) {
          contexto.cierre ??= {
            sesion: contexto.inicio.clave_operacion,
            motivo: contexto.motivo,
          };
          await this.repositorio.detener(contexto.viaje, contexto.cierre);
          this.terminar(
            contexto,
            contexto.motivo === "error_gps" ? "gpsSinSenal" : "",
          );
          return;
        }
        if (!this.observacion) {
          this.publicar({ fase: "buscando", error: "" });
          const observacion = await this.localizador.observar(
            (lectura) => this.recibir(contexto, lectura),
            () => {
              if (this.contexto === contexto) {
                void this.detener("error_gps");
                this.publicar({ error: "gpsSinSenal" });
              }
            },
          );
          if (this.contexto !== contexto) {
            observacion.remove();
            return;
          }
          if (!contexto.deseaCompartir || !this.primerPlano) {
            observacion.remove();
            continue;
          }
          this.observacion = observacion;
          // Reutilizar el primer GPS solo tras autorizar la sesión y revalidar
          // consentimiento, antigüedad y precisión mediante recibir().
          const lecturaInicial = contexto.lecturaInicial;
          contexto.lecturaInicial = null;
          if (lecturaInicial) this.recibir(contexto, lecturaInicial);
          if (contexto.posiciones.length) continue;
        }
        return;
      }
    } catch (error) {
      if (this.contexto !== contexto) return;
      this.pararCaptura();
      contexto.deseaCompartir = false;
      contexto.lecturaInicial = null;
      if (!contexto.autorizado) {
        this.terminar(contexto, codigoError(error));
        return;
      }
      // Una respuesta 409/403/401 es definitiva: jamás volver a emitir puntos rechazados.
      if (
        error instanceof ErrorAplicacion &&
        [401, 403, 404, 409].includes(error.estado)
      ) {
        this.terminar(contexto, "gpsSesionCerrada");
        return;
      }
      if (
        !resultadoIncierto(error) &&
        error instanceof ErrorAplicacion &&
        error.estado === 400
      ) {
        contexto.lote = null;
        contexto.posiciones = [];
      }
      contexto.motivo = "sin_conexion";
      this.publicar({
        fase: "pendiente",
        posicion: null,
        error: codigoError(error),
      });
    }
  }
}
