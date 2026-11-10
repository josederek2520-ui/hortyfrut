import { useCallback, useState, useRef } from "react";
import { View, Pressable, Alert } from "react-native";
import { usePreventRemove, useFocusEffect, useRouter } from "expo-router";
import {
  Truck,
  Warehouse,
  MapPin,
  Check,
  ArrowRight,
  Map,
} from "lucide-react-native";
import {
  repositorioDespachos,
  gestorOperaciones,
  gestorRutas,
} from "@/composicion/dependencias";
import { usarConsulta } from "@/compartido/aplicacion/usarConsulta";
import {
  Pantalla,
  Tarjeta,
  Texto,
  Boton,
  Aviso,
  EstadoCarga,
  Paginador,
} from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { usarSesion } from "@/modulos/sesion/presentacion/ProveedorSesion";
import { siguienteAccion, siguienteParada } from "../aplicacion/accionesViaje";
import {
  cantidad,
  fechaCorta,
  etiquetaEstado,
} from "@/modulos/despachos/presentacion/formatos";
import { codigoError, ErrorAplicacion } from "@/compartido/dominio/Errores";
import type { ClaveMensaje } from "@/compartido/traducciones/mensajes";
import PedidosParada from "./PedidosParada";
import PanelSeguimiento from "@/modulos/seguimiento/presentacion/PanelSeguimiento";

export default function PantallaRecorrido({
  identificador,
}: {
  identificador: number;
}) {
  const { colores, idioma, t } = usarInterfaz(),
    { sesion } = usarSesion();
  const navegador = useRouter();
  const consultar = useCallback(
    (senal: AbortSignal) => repositorioDespachos.detalle(identificador, senal),
    [identificador],
  );
  const consulta = usarConsulta(`viaje:${identificador}`, consultar);
  const [pagina, establecerPagina] = useState(1),
    [seleccionada, establecerSeleccionada] = useState<number | null>(null);
  const [ocupado, establecerOcupado] = useState(false),
    [error, establecerError] = useState("");
  const candado = useRef(false);
  useFocusEffect(
    useCallback(() => {
      consulta.recargar();
    }, [consulta.recargar]),
  );
  usePreventRemove(ocupado && !!sesion);
  const viaje = consulta.datos;
  const ejecutar = async (reintento = false) => {
    if (!viaje || candado.current) return;
    const accion = siguienteAccion(viaje, sesion?.puedeOperar ?? false),
      parada = siguienteParada(viaje);
    if (!reintento && (!accion || accion === "pedidos")) return;
    candado.current = true;
    establecerOcupado(true);
    establecerError("");
    try {
      if (reintento) await gestorOperaciones.reintentar(identificador);
      else
        await gestorOperaciones.ejecutar(identificador, accion!, {
          version: viaje.version,
          ...(accion === "llegar" ? { parada: parada?.id } : {}),
        });
      establecerSeleccionada(null);
      consulta.recargar();
    } catch (problema) {
      establecerError(
        problema instanceof ErrorAplicacion &&
          idioma === "es" &&
          problema.detalle
          ? problema.detalle
          : t(`error_${codigoError(problema)}` as ClaveMensaje),
      );
    } finally {
      candado.current = false;
      establecerOcupado(false);
    }
  };
  if (!viaje || consulta.cargando || consulta.error)
    return (
      <Pantalla titulo={t("viaje")} volver>
        <EstadoCarga error={consulta.error} alReintentar={consulta.recargar} />
      </Pantalla>
    );
  const siguiente = siguienteParada(viaje),
    accion = siguienteAccion(viaje, sesion?.puedeOperar ?? false);
  const parada =
    viaje.paradas.find((fila) => fila.id === seleccionada) ??
    siguiente ??
    viaje.paradas[0];
  const pendiente = gestorOperaciones.pendiente(identificador);
  const recorridoPendiente = gestorRutas.tieneOperacion(identificador);
  const confirmar = () => {
    if (accion === "pedidos" && siguiente) {
      establecerSeleccionada(siguiente.id);
      return;
    }
    const titulo =
      accion === "iniciar"
        ? "confirmarInicio"
        : accion === "llegar"
          ? "confirmarLlegada"
          : "confirmarFinal";
    const ayuda =
      accion === "iniciar"
        ? "confirmarInicioAyuda"
        : accion === "llegar"
          ? "confirmarLlegadaAyuda"
          : "confirmarFinalAyuda";
    Alert.alert(t(titulo), t(ayuda), [
      { text: t("cancelar"), style: "cancel" },
      { text: t("confirmar"), onPress: () => void ejecutar() },
    ]);
  };
  const principal = pendiente
    ? t("reintentar")
    : accion === "iniciar"
      ? t("empezar")
      : accion === "llegar"
        ? t("llegada")
        : accion === "finalizar"
          ? t("terminar")
          : null;
  return (
    <Pantalla
      titulo={viaje.codigo}
      ayuda={`${fechaCorta(viaje.fechaReparto, idioma)} · ${t(etiquetaEstado(viaje.estado))}`}
      volver
      pie={
        principal ? (
          <Boton
            titulo={principal}
            alPulsar={() => (pendiente ? void ejecutar(true) : confirmar())}
            ocupado={ocupado}
            deshabilitado={recorridoPendiente}
          />
        ) : undefined
      }
    >
      {pendiente ? <Aviso>{t("inciertoAyuda")}</Aviso> : null}
      {recorridoPendiente ? <Aviso>{t("rutaOperacionPendiente")}</Aviso> : null}
      {error ? <Aviso error>{error}</Aviso> : null}
      <PanelSeguimiento
        viaje={identificador}
        version={viaje.version}
        enRuta={viaje.estado === "en_ruta"}
        puedeOperar={sesion?.puedeOperar ?? false}
        ocupado={ocupado}
      />
      <Boton
        titulo={t(
          viaje.estado === "borrador" ? "prepararRecorrido" : "verMapa",
        )}
        alPulsar={() =>
          navegador.push({
            pathname: "/(chofer)/mapa/[identificador]",
            params: { identificador },
          })
        }
        secundario
        deshabilitado={ocupado || !!pendiente}
        icono={<Map size={20} color={colores.verdeTexto} />}
      />
      {!sesion?.puedeOperar ? <Aviso>{t("soloConsulta")}</Aviso> : null}
      {viaje.estado === "borrador" && viaje.capacidad !== "apta" ? (
        <Aviso>{t("capacidad")}</Aviso>
      ) : null}
      <Tarjeta>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Truck size={22} color={colores.verdeTexto} />
          <Texto tipo="subtitulo">{viaje.vehiculo}</Texto>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Warehouse size={17} color={colores.secundario} />
          <Texto tipo="pequeno" color={colores.secundario}>
            {viaje.almacen}
          </Texto>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 14,
          }}
        >
          <View>
            <Texto tipo="pequeno" color={colores.secundario}>
              {t("peso")}
            </Texto>
            <Texto tipo="numero">
              {cantidad(viaje.resumen.pesoKg, idioma)} <Texto>kg</Texto>
            </Texto>
          </View>
          <Texto tipo="pequeno" color={colores.secundario}>
            {t("destinos", { cantidad: viaje.resumen.paradas })}
          </Texto>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: viaje.resumen.pedidos,
            now: viaje.resumen.pedidosDescargados,
          }}
          style={{
            borderTopWidth: 1,
            borderColor: colores.borde,
            paddingTop: 12,
          }}
        >
          <Texto tipo="pequeno">
            {t("pedidosDescargados", {
              descargados: viaje.resumen.pedidosDescargados,
              total: viaje.resumen.pedidos,
            })}
          </Texto>
        </View>
      </Tarjeta>
      {viaje.observaciones ? (
        <Tarjeta>
          <Texto tipo="pequeno" style={{ fontWeight: "700" }}>
            {t("indicaciones")}
          </Texto>
          <Texto>{viaje.observaciones}</Texto>
        </Tarjeta>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Texto tipo="subtitulo">{t("ruta")}</Texto>
        <Pressable
          accessibilityRole="button"
          onPress={consulta.recargar}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Texto tipo="pequeno" color={colores.verdeTexto}>
            {t("actualizar")}
          </Texto>
        </Pressable>
      </View>
      {viaje.paradas.slice((pagina - 1) * 10, pagina * 10).map((fila) => (
        <Pressable
          key={fila.id}
          accessibilityRole="button"
          accessibilityState={{ selected: fila.id === parada?.id }}
          disabled={ocupado}
          onPress={() => establecerSeleccionada(fila.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 15,
            borderWidth: 1,
            borderColor: fila.id === parada?.id ? colores.verde : colores.borde,
            borderRadius: 18,
            backgroundColor:
              fila.id === parada?.id ? colores.verdeSuave : colores.tarjeta,
          }}
        >
          <View
            style={{
              minWidth: 38,
              minHeight: 38,
              borderRadius: 13,
              backgroundColor: colores.tarjeta,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {fila.descargadaEn ? (
              <Check size={20} color={colores.verdeTexto} />
            ) : (
              <Texto style={{ fontWeight: "700" }}>{fila.orden}</Texto>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Texto style={{ fontWeight: "700" }}>{fila.nombre}</Texto>
            <Texto tipo="pequeno" color={colores.secundario}>
              {fila.cliente}
            </Texto>
            <Texto tipo="pequeno" color={colores.verdeTexto}>
              {t("pedidosDescargados", {
                descargados: fila.pedidosDescargados,
                total: fila.pedidos,
              })}
            </Texto>
          </View>
          <ArrowRight size={18} color={colores.secundario} />
        </Pressable>
      ))}
      <Paginador
        pagina={pagina}
        total={viaje.paradas.length}
        alCambiar={establecerPagina}
        ocupado={ocupado}
      />
      {parada && (
        <Tarjeta>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <MapPin color={colores.verdeTexto} size={20} />
            <Texto tipo="subtitulo">{parada.nombre}</Texto>
          </View>
          <Texto color={colores.secundario}>{parada.direccion}</Texto>
          <PedidosParada
            key={`${viaje.version}:${parada.id}`}
            viaje={viaje}
            parada={parada}
            puedeConfirmar={
              !!sesion?.puedeOperar &&
              viaje.estado === "en_ruta" &&
              siguiente?.id === parada.id &&
              !!parada.llegadaEn &&
              !pendiente
            }
          />
        </Tarjeta>
      )}
      {viaje.estado === "en_ruta" && !siguiente && (
        <Aviso>{t("regresar")}</Aviso>
      )}
      {viaje.estado === "finalizado" && <Aviso>{t("completado")}</Aviso>}
    </Pantalla>
  );
}
