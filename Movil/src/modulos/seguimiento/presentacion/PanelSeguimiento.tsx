import { useSyncExternalStore } from "react";
import { Alert, View } from "react-native";
import { LocateFixed, MapPinOff } from "lucide-react-native";
import { gestorSeguimiento } from "@/composicion/dependencias";
import { Boton, Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import type { ClaveMensaje } from "@/compartido/traducciones/mensajes";

const erroresGps: Record<string, ClaveMensaje> = {
  gpsPermiso: "error_gpsPermiso",
  gpsApagado: "error_gpsApagado",
  gpsNoDisponible: "error_gpsNoDisponible",
  gpsPrimerPlano: "error_gpsPrimerPlano",
  gpsPrecision: "error_gpsPrecision",
  gpsSinSenal: "error_gpsSinSenal",
  gpsSesionCerrada: "error_gpsSesionCerrada",
  validacion: "error_validacion",
  datos: "error_datos",
  intentos: "error_intentos",
  configuracion: "error_configuracion",
};

export default function PanelSeguimiento({
  viaje,
  version,
  enRuta,
  puedeOperar,
  ocupado = false,
}: {
  viaje: number;
  version: string;
  enRuta: boolean;
  puedeOperar: boolean;
  ocupado?: boolean;
}) {
  const estado = useSyncExternalStore(
    gestorSeguimiento.suscribir,
    gestorSeguimiento.obtenerEstado,
    gestorSeguimiento.obtenerEstado,
  );
  const { colores, t, idioma } = usarInterfaz();
  const propio = estado.viaje === viaje;
  const activo =
    propio && ["iniciando", "buscando", "compartiendo"].includes(estado.fase);
  const pendiente = propio && estado.fase === "pendiente";
  const ocupadoOtro =
    estado.viaje !== null &&
    !propio &&
    ["iniciando", "buscando", "compartiendo", "pendiente"].includes(
      estado.fase,
    );
  if (!puedeOperar || (!enRuta && !activo && !pendiente)) return null;
  const texto = activo
    ? t(
        estado.fase === "compartiendo"
          ? "gpsCompartiendo"
          : estado.fase === "iniciando"
            ? "gpsIniciando"
            : "gpsBuscando",
      )
    : pendiente
      ? t("gpsPendiente")
      : t("gpsPrimerPlanoAyuda");
  const mensajeError =
    propio && estado.error
      ? t(erroresGps[estado.error] ?? "error_conexion")
      : "";
  const iniciar = () =>
    Alert.alert(t("gpsCompartir"), t("gpsConsentimiento"), [
      { text: t("cancelar"), style: "cancel" },
      {
        text: t("gpsCompartir"),
        onPress: () => {
          void gestorSeguimiento.iniciar(viaje, version).catch(() => {});
        },
      },
    ]);
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 6,
        borderBottomWidth: 1,
        borderColor: colores.borde,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {activo ? (
          <LocateFixed size={19} color={colores.verdeTexto} />
        ) : (
          <MapPinOff size={19} color={colores.secundario} />
        )}
        <View style={{ flex: 1 }}>
          <Texto tipo="pequeno" style={{ fontWeight: "600" }}>
            {texto}
          </Texto>
          {propio && estado.posicion && (
            <Texto tipo="pequeno" color={colores.secundario}>
              {t("gpsPrecisionHora", {
                metros: Math.ceil(estado.posicion.precisionM),
                hora: new Date(estado.posicion.capturadaEn).toLocaleTimeString(
                  idioma,
                  { hour: "2-digit", minute: "2-digit", second: "2-digit" },
                ),
              })}
            </Texto>
          )}
        </View>
      </View>
      {!!mensajeError && (
        <Texto tipo="pequeno" color={colores.error}>
          {mensajeError}
        </Texto>
      )}
      {ocupadoOtro && (
        <Texto tipo="pequeno" color={colores.secundario}>
          {t("gpsOtroViaje")}
        </Texto>
      )}
      <Boton
        titulo={
          activo
            ? t("gpsDetener")
            : pendiente
              ? t("gpsReintentar")
              : t("gpsCompartir")
        }
        secundario
        deshabilitado={
          ocupado || ocupadoOtro || (!enRuta && !pendiente && !activo)
        }
        alPulsar={
          activo
            ? () => {
                void gestorSeguimiento.detener();
              }
            : pendiente
              ? () => {
                  void gestorSeguimiento.reintentar();
                }
              : iniciar
        }
      />
    </View>
  );
}
