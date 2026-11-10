import { ErrorAplicacion } from "@/compartido/dominio/Errores";
import type { Localizador } from "../dominio/Seguimiento";

export class LocalizadorExpo implements Localizador {
  async autorizar() {
    let localizacion: typeof import("expo-location");
    try {
      localizacion = await import("expo-location");
    } catch {
      throw new ErrorAplicacion("gpsNoDisponible");
    }
    if (!(await localizacion.requestForegroundPermissionsAsync()).granted)
      throw new ErrorAplicacion("gpsPermiso");
    if (!(await localizacion.hasServicesEnabledAsync()))
      throw new ErrorAplicacion("gpsApagado");
  }
  async observar(
    alPosicion: Parameters<Localizador["observar"]>[0],
    alError: () => void,
  ) {
    const localizacion = await import("expo-location");
    return localizacion.watchPositionAsync(
      {
        accuracy: localizacion.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 5,
      },
      ({ coords, timestamp }) =>
        alPosicion({
          latitud: coords.latitude,
          longitud: coords.longitude,
          precisionM: coords.accuracy,
          instante: timestamp,
          velocidadMS: coords.speed,
          rumbo: coords.heading,
        }),
      alError,
    );
  }
}
