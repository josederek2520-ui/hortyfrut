import * as Crypto from "expo-crypto";
import {
  ClienteApi,
  normalizarServidor,
} from "@/infraestructura/api/ClienteApi";
import { AlmacenSeguro } from "@/infraestructura/seguridad/AlmacenSeguro";
import { RepositorioSesionHttp } from "@/modulos/sesion/datos/RepositorioSesionHttp";
import { ServicioSesion } from "@/modulos/sesion/aplicacion/ServicioSesion";
import { RepositorioDespachosHttp } from "@/modulos/despachos/datos/RepositorioDespachosHttp";
import { GestorOperaciones } from "@/modulos/recorrido/aplicacion/GestorOperaciones";
import type { RepositorioDespachos } from "@/modulos/despachos/dominio/RepositorioDespachos";
import { RepositorioRutasHttp } from "@/modulos/recorrido/datos/RepositorioRutasHttp";
import { GestorRutas } from "@/modulos/recorrido/aplicacion/GestorRutas";
import { GestorSeguimiento } from "@/modulos/seguimiento/aplicacion/GestorSeguimiento";
import { RepositorioSeguimientoHttp } from "@/modulos/seguimiento/datos/RepositorioSeguimientoHttp";
import { LocalizadorExpo } from "@/modulos/seguimiento/datos/LocalizadorExpo";

const almacen = new AlmacenSeguro();
// La direccion es configuracion publica. Nunca incluir contrasenas ni tokens aqui.
let servidor = "";
try {
  servidor = normalizarServidor(
    process.env.EXPO_PUBLIC_API_URL ??
      (__DEV__ ? "http://10.0.2.2:8000/api/v1/" : ""),
    __DEV__,
  );
} catch {
  /* La pantalla mostrara el error de configuracion sin cerrar la app. */
}
const cliente = new ClienteApi(
  servidor,
  async () => (await almacen.sesion())?.credencial ?? null,
);
export const repositorioDespachos: RepositorioDespachos =
  new RepositorioDespachosHttp(cliente);
export const repositorioRutas = new RepositorioRutasHttp(cliente);
export const gestorSeguimiento = new GestorSeguimiento(
  new RepositorioSeguimientoHttp(cliente),
  new LocalizadorExpo(),
  Crypto.randomUUID,
);
export const gestorOperaciones: GestorOperaciones = new GestorOperaciones(
  repositorioDespachos,
  Crypto.randomUUID,
  (viaje) => gestorRutas.tieneOperacion(viaje),
  (viaje) => {
    if (gestorSeguimiento.obtenerEstado().viaje === viaje)
      void gestorSeguimiento.detener();
  },
);
export const gestorRutas: GestorRutas = new GestorRutas(
  repositorioRutas,
  Crypto.randomUUID,
  (viaje) => gestorOperaciones.tieneOperacion(viaje),
);
export const servicioSesion = new ServicioSesion(
  new RepositorioSesionHttp(cliente, almacen, Crypto.randomUUID),
  () => {
    gestorOperaciones.limpiar();
    gestorRutas.limpiar();
    gestorSeguimiento.limpiar();
  },
  () => {
    void gestorSeguimiento.detener("cuenta");
  },
);
cliente.alNoAutorizado = () => {
  void servicioSesion.expirar().catch(() => {});
};
export { almacen };
