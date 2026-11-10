import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
import type { LecturaUbicacion, Localizador } from "../dominio/Seguimiento";

function lectura(posicion: GeolocationPosition): LecturaUbicacion {
  return {
    latitud: posicion.coords.latitude,
    longitud: posicion.coords.longitude,
    precisionM: posicion.coords.accuracy,
    instante: posicion.timestamp,
    velocidadMS: posicion.coords.speed,
    rumbo: posicion.coords.heading,
  };
}

export class LocalizadorNavegador implements Localizador {
  async autorizar() {
    if (!window.isSecureContext) throw new ErrorAplicacion("gpsHttps");
    if (!navigator.geolocation) throw new ErrorAplicacion("gpsNoDisponible");
    if (document.visibilityState !== "visible")
      throw new ErrorAplicacion("gpsPrimerPlano");
    return new Promise<LecturaUbicacion>((resolver, rechazar) =>
      navigator.geolocation.getCurrentPosition(
        (posicion) => resolver(lectura(posicion)),
        (error) =>
          rechazar(
            new ErrorAplicacion(
              error.code === 1 ? "gpsPermiso" : "gpsSinSenal",
            ),
          ),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      ),
    );
  }
  async observar(
    alPosicion: (posicion: LecturaUbicacion) => void,
    alError: () => void,
  ) {
    const identificador = navigator.geolocation.watchPosition(
      (posicion) => alPosicion(lectura(posicion)),
      alError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return { remove: () => navigator.geolocation.clearWatch(identificador) };
  }
}
