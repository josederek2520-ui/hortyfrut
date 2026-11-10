import { ErrorAplicacion } from "@/compartido/dominio/Errores";
import type { Localizador } from "../dominio/Seguimiento";

// Expo web es apoyo de desarrollo; la captura de esta etapa es Android nativa.
export class LocalizadorExpo implements Localizador {
  async autorizar(): Promise<void> {
    throw new ErrorAplicacion("gpsNoDisponible");
  }
  async observar(): ReturnType<Localizador["observar"]> {
    throw new ErrorAplicacion("gpsNoDisponible");
  }
}
