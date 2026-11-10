import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect, usePreventRemove, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Maximize,
  Moon,
  RefreshCw,
  Sun,
  LocateFixed,
} from "lucide-react-native";
import {
  gestorOperaciones,
  gestorRutas,
  repositorioDespachos,
  repositorioRutas,
  gestorSeguimiento,
} from "@/composicion/dependencias";
import { usarConsulta } from "@/compartido/aplicacion/usarConsulta";
import { Boton, EstadoCarga, Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { codigoError, ErrorAplicacion } from "@/compartido/dominio/Errores";
import type { ClaveMensaje } from "@/compartido/traducciones/mensajes";
import { usarSesion } from "@/modulos/sesion/presentacion/ProveedorSesion";
import { enlaceNavegacion } from "../aplicacion/geometriaRuta";
import { ordenarRuta, paradasRuta } from "../aplicacion/ordenRuta";
import { siguienteParada } from "../aplicacion/accionesViaje";
import type { AccionRuta } from "../dominio/Ruta";
import LimiteMapa from "./LimiteMapa";
import PanelRutaChofer from "./PanelRutaChofer";
import PanelSeguimiento from "@/modulos/seguimiento/presentacion/PanelSeguimiento";
const MapaRecorrido = lazy(() => import("./MapaRecorrido"));

export default function PantallaMapaViaje({
  identificador,
}: {
  identificador: number;
}) {
  const { colores, oscuro, cambiarTema, idioma, t } = usarInterfaz();
  const { sesion } = usarSesion();
  const seguimiento = useSyncExternalStore(
    gestorSeguimiento.suscribir,
    gestorSeguimiento.obtenerEstado,
    gestorSeguimiento.obtenerEstado,
  );
  const posicionChofer =
    seguimiento.viaje === identificador ? seguimiento.posicion : null;
  const [centroUbicacion, establecerCentroUbicacion] = useState<
    [number, number] | null
  >(null);
  const navegador = useRouter(),
    margenes = useSafeAreaInsets(),
    ventana = useWindowDimensions();
  const [expandida, establecerExpandida] = useState(false);
  const [pantallaActiva, establecerPantallaActiva] = useState(true);
  const [revisionEncuadre, establecerRevisionEncuadre] = useState(0);
  const [revisionMapa, establecerRevisionMapa] = useState(0);
  const [falloMapa, establecerFalloMapa] = useState<"carga" | "espera" | null>(
    null,
  );
  const [cargandoMapa, establecerCargandoMapa] = useState(true);
  const [altoCabecera, establecerAltoCabecera] = useState(64);
  const [altoTarjeta, establecerAltoTarjeta] = useState(150);
  const [ordenLocal, establecerOrdenLocal] = useState<{
    version: string;
    orden: number[];
  } | null>(null);
  const [ocupado, establecerOcupado] = useState(false),
    [error, establecerError] = useState("");
  const candado = useRef(false);
  const consultar = useCallback(
    async (senal: AbortSignal) => {
      const [viaje, ruta] = await Promise.all([
        repositorioDespachos.detalle(identificador, senal),
        repositorioRutas.consultar(identificador, senal),
      ]);
      if (ruta.despacho !== viaje.id || ruta.versionDespacho !== viaje.version)
        throw new ErrorAplicacion("conflicto", 409);
      return { viaje, ruta };
    },
    [identificador],
  );
  const consulta = usarConsulta(
    `mapa:${sesion?.usuario.id}:${identificador}`,
    consultar,
    true,
  );
  useFocusEffect(
    useCallback(() => {
      establecerPantallaActiva(true);
      consulta.recargar();
      return () => establecerPantallaActiva(false);
    }, [consulta.recargar]),
  );
  usePreventRemove(ocupado && !!sesion);
  const alIniciarCargaMapa = useCallback(() => {
    establecerFalloMapa(null);
    establecerCargandoMapa(true);
  }, []);
  const alErrorMapa = useCallback(() => {
    establecerFalloMapa("carga");
    establecerCargandoMapa(false);
  }, []);
  const alCargarMapa = useCallback(() => {
    establecerFalloMapa(null);
    establecerCargandoMapa(false);
  }, []);
  const volver = () => {
    if (!ocupado)
      navegador.canGoBack()
        ? navegador.back()
        : navegador.replace("/(chofer)/viajes");
  };
  const abrirViaje = () =>
    navegador.navigate({
      pathname: "/(chofer)/viaje/[identificador]",
      params: { identificador },
    });
  const datos = consulta.datos;
  const ruta =
    datos && ordenLocal?.version === datos.ruta.versionDespacho
      ? ordenarRuta(datos.ruta, ordenLocal.orden)
      : datos?.ruta;
  const siguiente = datos ? siguienteParada(datos.viaje) : undefined;
  const destino = ruta?.preparando
    ? paradasRuta(ruta)[0]
    : ruta?.plan?.puntos.find((punto) =>
        siguiente ? punto.parada === siguiente.id : punto.tipo === "retorno",
      );
  const pendienteRuta = gestorRutas.pendiente(identificador),
    pendienteViaje = gestorOperaciones.pendiente(identificador);
  const pendiente = !!pendienteRuta || !!pendienteViaje;
  const calculando =
    ruta?.optimizacion?.estado === "pendiente" ||
    ruta?.optimizacion?.estado === "calculando";
  useEffect(() => {
    if (!calculando || ocupado || !sesion || !pantallaActiva) return;
    const temporizador = setTimeout(consulta.recargar, 1800);
    return () => clearTimeout(temporizador);
  }, [
    calculando,
    ocupado,
    sesion,
    pantallaActiva,
    consulta.datos,
    consulta.error,
    consulta.recargar,
  ]);
  const ejecutar = async (accion?: AccionRuta | "iniciar") => {
    if (candado.current || !datos || !ruta) return;
    candado.current = true;
    establecerOcupado(true);
    establecerError("");
    try {
      if (pendienteRuta) await gestorRutas.reintentar(identificador);
      else if (pendienteViaje)
        await gestorOperaciones.reintentar(identificador);
      else if (accion === "iniciar")
        await gestorOperaciones.ejecutar(identificador, "iniciar", {
          version: datos.viaje.version,
        });
      else if (accion)
        await gestorRutas.ejecutar(identificador, accion, {
          version: ruta.versionDespacho,
          ...(accion === "cancelar-optimizacion"
            ? { calculo: ruta.optimizacion?.id }
            : accion === "calcular-ruta" || accion === "optimizar-ruta"
              ? {
                  orden_paradas: paradasRuta(ruta).map(
                    (punto) => punto.parada!,
                  ),
                }
              : { plan: ruta.plan?.id }),
        });
      establecerOrdenLocal(null);
      consulta.recargar();
    } catch (problema) {
      establecerError(
        problema instanceof ErrorAplicacion &&
          idioma === "es" &&
          problema.detalle
          ? problema.detalle
          : t(`error_${codigoError(problema)}` as ClaveMensaje),
      );
      if (codigoError(problema) === "conflicto") {
        establecerOrdenLocal(null);
        consulta.recargar();
      }
    } finally {
      candado.current = false;
      establecerOcupado(false);
    }
  };
  const iniciar = () =>
    Alert.alert(t("confirmarInicio"), t("confirmarInicioAyuda"), [
      { text: t("cancelar"), style: "cancel" },
      { text: t("confirmar"), onPress: () => void ejecutar("iniciar") },
    ]);
  const navegar = () => {
    const direccion = destino ? enlaceNavegacion(destino) : null;
    if (!direccion) return;
    Alert.alert(t("abrirNavegacion"), t("navegacionExternaAyuda"), [
      { text: t("cancelar"), style: "cancel" },
      {
        text: t("abrirNavegacion"),
        onPress: () => {
          void Linking.openURL(direccion).catch(() =>
            Alert.alert(t("errorTitulo"), t("errorNavegacion")),
          );
        },
      },
    ]);
  };
  const puedePreparar = ruta?.puedeOrdenar && sesion?.puedeOperar;
  const accion = pendiente
    ? "reintentar"
    : calculando
      ? "esperar"
      : puedePreparar && ruta?.puedeAprobar
        ? "aprobar-ruta"
        : puedePreparar && ruta?.estado === "lista"
          ? "iniciar"
          : puedePreparar && ruta?.puedeCalcular
            ? ruta.puedeOptimizar
              ? "optimizar-ruta"
              : "calcular-ruta"
            : "entregas";
  const tituloAccion = t(
    accion === "reintentar"
      ? "reintentar"
      : accion === "esperar"
        ? "calculandoOptimizacion"
        : accion === "optimizar-ruta"
          ? "optimizarRecorrido"
          : accion === "aprobar-ruta"
            ? "usarRecorrido"
            : accion === "iniciar"
              ? "iniciarViajeMapa"
              : accion === "calcular-ruta"
                ? "calcularRecorrido"
                : ruta?.preparando
                  ? "volverViaje"
                  : "verEntregas",
  );
  const alAccion = () => {
    if (accion === "esperar") return;
    if (accion === "entregas") abrirViaje();
    else if (accion === "iniciar") iniciar();
    else void ejecutar(accion === "reintentar" ? undefined : accion);
  };
  const inicioBloqueado =
    accion === "iniciar" && datos?.viaje.capacidad !== "apta";
  const resumen =
    ruta?.plan && ruta.estado !== "obsoleta"
      ? t("resumenRutaMapa", {
          kilometros: new Intl.NumberFormat(idioma, {
            maximumFractionDigits: 1,
          }).format(ruta.plan.distanciaM / 1000),
          minutos: Math.max(1, Math.ceil(ruta.plan.duracionS / 60)),
        })
      : "";
  const hayMapa =
    !!posicionChofer || !!ruta?.puntos.some((punto) => punto.posicion);
  useEffect(() => {
    if (!hayMapa || !cargandoMapa || falloMapa || !pantallaActiva) return;
    const temporizador = setTimeout(() => {
      establecerFalloMapa("espera");
      establecerCargandoMapa(false);
    }, 20000);
    return () => clearTimeout(temporizador);
  }, [
    hayMapa,
    cargandoMapa,
    falloMapa,
    pantallaActiva,
    identificador,
    revisionMapa,
  ]);
  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      <StatusBar barStyle={oscuro ? "light-content" : "dark-content"} />
      {datos && ruta && hayMapa && (
        <LimiteMapa
          key={`${identificador}:${revisionMapa}`}
          alError={alErrorMapa}
        >
          <Suspense fallback={null}>
            <MapaRecorrido
              ruta={ruta}
              siguiente={
                ruta.preparando
                  ? (destino?.parada ?? null)
                  : (siguiente?.id ?? null)
              }
              espacioSuperior={altoCabecera + margenes.top + 8}
              espacioInferior={altoTarjeta + margenes.bottom + 20}
              revisionEncuadre={revisionEncuadre}
              posicionChofer={posicionChofer}
              centroUbicacion={centroUbicacion}
              alIniciarCarga={alIniciarCargaMapa}
              alError={alErrorMapa}
              alCargar={alCargarMapa}
            />
          </Suspense>
        </LimiteMapa>
      )}
      <View
        style={[
          estilos.cabecera,
          {
            top: margenes.top + 8,
            backgroundColor: colores.tarjeta,
            borderColor: colores.borde,
          },
        ]}
        onLayout={(evento) =>
          establecerAltoCabecera(evento.nativeEvent.layout.height)
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("volver")}
          disabled={ocupado}
          onPress={volver}
          style={estilos.icono}
        >
          <ArrowLeft size={22} color={colores.texto} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Texto tipo="subtitulo">{t("mapaViaje")}</Texto>
          <Texto tipo="pequeno" color={colores.secundario}>
            {datos?.viaje.codigo ?? t("cargando")}
          </Texto>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(oscuro ? "usarTemaClaro" : "usarTemaOscuro")}
          onPress={() =>
            void cambiarTema(oscuro ? "claro" : "oscuro").catch(() =>
              Alert.alert(t("errorTitulo"), t("errorGuardarTema")),
            )
          }
          style={estilos.icono}
        >
          {oscuro ? (
            <Sun size={21} color={colores.verdeTexto} />
          ) : (
            <Moon size={21} color={colores.verdeTexto} />
          )}
        </Pressable>
      </View>
      {!datos || !ruta ? (
        <View
          style={[
            estilos.estado,
            { paddingTop: altoCabecera + margenes.top + 28 },
          ]}
        >
          <EstadoCarga
            error={consulta.error}
            alReintentar={consulta.recargar}
          />
        </View>
      ) : (
        <>
          <View
            style={{
              position: "absolute",
              right: 16,
              top: margenes.top + altoCabecera + 24,
              gap: 10,
            }}
          >
            {hayMapa && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("encuadrarRuta")}
                onPress={() => establecerRevisionEncuadre((valor) => valor + 1)}
                style={[
                  estilos.control,
                  {
                    backgroundColor: colores.tarjeta,
                    borderColor: colores.borde,
                  },
                ]}
              >
                <Maximize size={21} color={colores.texto} />
              </Pressable>
            )}
            {!!posicionChofer && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("gpsCentrar")}
                onPress={() =>
                  establecerCentroUbicacion([
                    posicionChofer.longitud,
                    posicionChofer.latitud,
                  ])
                }
                style={[
                  estilos.control,
                  {
                    backgroundColor: colores.tarjeta,
                    borderColor: colores.borde,
                  },
                ]}
              >
                <LocateFixed size={21} color={colores.pendienteTexto} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("actualizar")}
              disabled={ocupado}
              onPress={() => {
                establecerOrdenLocal(null);
                consulta.recargar();
              }}
              style={[
                estilos.control,
                {
                  backgroundColor: colores.tarjeta,
                  borderColor: colores.borde,
                },
              ]}
            >
              <RefreshCw size={20} color={colores.texto} />
            </Pressable>
          </View>
          {hayMapa && cargandoMapa && !falloMapa && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: margenes.top + altoCabecera + 28,
                alignSelf: "center",
                backgroundColor: colores.tarjeta,
                borderRadius: 20,
                padding: 10,
              }}
            >
              <ActivityIndicator color={colores.verdeTexto} />
            </View>
          )}
          {falloMapa && (
            <View
              style={{
                position: "absolute",
                top: margenes.top + altoCabecera + 80,
                left: 16,
                right: 16,
                padding: 12,
                borderRadius: 16,
                gap: 8,
                backgroundColor: colores.tarjeta,
              }}
            >
              <Texto tipo="pequeno" color={colores.error}>
                {t(falloMapa === "espera" ? "esperaMapaAgotada" : "errorMapa")}
              </Texto>
              <Boton
                titulo={t("reintentar")}
                secundario
                alPulsar={() => {
                  establecerFalloMapa(null);
                  establecerCargandoMapa(true);
                  establecerRevisionMapa((valor) => valor + 1);
                }}
              />
            </View>
          )}
          {!hayMapa && (
            <View
              style={[
                estilos.estado,
                {
                  paddingTop: altoCabecera + margenes.top + 28,
                  paddingBottom: altoTarjeta + margenes.bottom,
                },
              ]}
            >
              <Texto color={colores.secundario}>
                {t("rutaSinAprobarAyuda")}
              </Texto>
            </View>
          )}
          <View
            style={[
              estilos.tarjeta,
              {
                bottom: margenes.bottom + 8,
                maxHeight: ventana.height * 0.6,
                backgroundColor: colores.tarjeta,
                borderColor: colores.borde,
              },
            ]}
            onLayout={(evento) =>
              establecerAltoTarjeta(evento.nativeEvent.layout.height)
            }
          >
            <PanelSeguimiento
              viaje={identificador}
              version={datos.viaje.version}
              enRuta={datos.viaje.estado === "en_ruta"}
              puedeOperar={sesion?.puedeOperar ?? false}
              ocupado={ocupado}
            />
            <PanelRutaChofer
              ruta={ruta}
              destino={destino?.nombre ?? datos.viaje.almacen}
              expandida={expandida}
              alExpandir={() => establecerExpandida((valor) => !valor)}
              ocupado={ocupado || consulta.cargando}
              ordenBloqueado={pendiente || calculando}
              accionBloqueada={
                inicioBloqueado || calculando || consulta.cargando
              }
              alCancelarCalculo={
                calculando && sesion?.puedeOperar && !pendiente
                  ? () => void ejecutar("cancelar-optimizacion")
                  : undefined
              }
              alCalcularOrden={
                !calculando && ruta.puedeCalcular && !pendiente && ordenLocal
                  ? () => void ejecutar("calcular-ruta")
                  : undefined
              }
              alOptimizar={
                !calculando && ruta.puedeOptimizar && !!ruta.plan && !pendiente
                  ? () => void ejecutar("optimizar-ruta")
                  : undefined
              }
              alOrden={(orden) => {
                establecerOrdenLocal({ version: ruta.versionDespacho, orden });
                establecerError("");
              }}
              tituloAccion={tituloAccion}
              alAccion={alAccion}
              resumen={resumen}
              error={
                error ||
                (consulta.error ? t("errorActualizarCalculo") : "") ||
                (ruta.optimizacion?.estado === "error"
                  ? idioma === "es"
                    ? ruta.optimizacion.error
                    : t("errorOptimizacion")
                  : "") ||
                (ruta.optimizacion?.estado === "obsoleta"
                  ? t("rutaObsoletaCorta")
                  : "") ||
                (inicioBloqueado
                  ? t("capacidad")
                  : pendiente
                    ? t("rutaOperacionPendiente")
                    : "")
              }
              alNavegar={
                destino?.posicion && datos.viaje.estado === "en_ruta"
                  ? navegar
                  : undefined
              }
            />
          </View>
        </>
      )}
    </View>
  );
}
const estilos = StyleSheet.create({
  cabecera: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  icono: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  control: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  estado: { flex: 1, padding: 24, gap: 18, justifyContent: "center" },
  tarjeta: {
    position: "absolute",
    left: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
});
