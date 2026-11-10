import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  SlidersHorizontal,
  Truck,
} from "lucide-react-native";
import { repositorioDespachos } from "@/composicion/dependencias";
import { usarConsulta } from "@/compartido/aplicacion/usarConsulta";
import { BarraNavegacionChofer } from "@/compartido/componentes/BarraNavegacionChofer";
import {
  Boton,
  EstadoCarga,
  Paginador,
  Pantalla,
  Tarjeta,
  Texto,
} from "@/compartido/componentes/Elementos";
import { usarSesion } from "@/modulos/sesion/presentacion/ProveedorSesion";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { CabeceraViajes } from "./CabeceraViajes";
import { TarjetaViaje } from "./TarjetaViaje";

const filtros = [
  ["", "todosLosViajes"],
  ["borrador", "pendientes"],
  ["en_ruta", "enRuta"],
  ["finalizado", "finalizados"],
  ["cancelado", "cancelados"],
] as const;

export default function PantallaViajes() {
  const { sesion } = usarSesion(),
    { colores, t } = usarInterfaz(),
    navegador = useRouter();
  const [estado, establecerEstado] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [mostrarFiltros, establecerMostrarFiltros] = useState(false);
  const consultar = useCallback(
    (senal: AbortSignal) => repositorioDespachos.listar(pagina, estado, senal),
    [pagina, estado],
  );
  const consulta = usarConsulta(
    `viajes:${sesion?.usuario.id}:${estado}:${pagina}`,
    consultar,
  );
  useFocusEffect(
    useCallback(() => {
      consulta.recargar();
    }, [consulta.recargar]),
  );
  const filtroActual =
    filtros.find(([valor]) => valor === estado) ?? filtros[0];
  return (
    <Pantalla
      titulo={t("misViajes")}
      ayuda={t("jornada")}
      cabeceraPersonalizada={
        <CabeceraViajes nombre={sesion?.usuario.nombre ?? ""} />
      }
      alActualizar={consulta.recargar}
      actualizando={consulta.cargando}
      pie={<BarraNavegacionChofer actual="viajes" />}
    >
      <View style={estilos.controles}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("estadoViajes")}: ${t(filtroActual[1])}`}
          accessibilityState={{ expanded: mostrarFiltros }}
          onPress={() => establecerMostrarFiltros((anterior) => !anterior)}
          style={({ pressed }) => [
            estilos.selector,
            {
              backgroundColor: colores.tarjeta,
              borderColor: colores.borde,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <SlidersHorizontal size={17} color={colores.secundario} />
          <Texto tipo="pequeno" style={{ flex: 1, fontWeight: "600" }}>
            {t(filtroActual[1])}
          </Texto>
          {mostrarFiltros ? (
            <ChevronUp size={16} color={colores.secundario} />
          ) : (
            <ChevronDown size={16} color={colores.secundario} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("actualizar")}
          accessibilityState={{
            disabled: consulta.cargando,
            busy: consulta.cargando,
          }}
          disabled={consulta.cargando}
          onPress={consulta.recargar}
          style={({ pressed }) => [
            estilos.actualizar,
            {
              backgroundColor: colores.tarjeta,
              borderColor: colores.borde,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          {consulta.cargando ? (
            <ActivityIndicator size="small" color={colores.verdeTexto} />
          ) : (
            <RefreshCw size={19} color={colores.verdeTexto} />
          )}
        </Pressable>
      </View>
      {mostrarFiltros && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t("estadoViajes")}
          style={[
            estilos.filtros,
            { backgroundColor: colores.tarjeta, borderColor: colores.borde },
          ]}
        >
          {filtros.map(([valor, clave]) => (
            <Pressable
              key={clave}
              accessibilityRole="radio"
              accessibilityState={{ checked: estado === valor }}
              onPress={() => {
                establecerEstado(valor);
                establecerPagina(1);
                establecerMostrarFiltros(false);
              }}
              style={({ pressed }) => [
                estilos.filtro,
                {
                  backgroundColor:
                    estado === valor
                      ? colores.verdeSuave
                      : pressed
                        ? colores.neutroFondo
                        : "transparent",
                },
              ]}
            >
              <Texto
                tipo="pequeno"
                color={estado === valor ? colores.verdeTexto : colores.texto}
                style={{
                  flex: 1,
                  fontWeight: estado === valor ? "700" : "500",
                }}
              >
                {t(clave)}
              </Texto>
              {estado === valor && (
                <Check size={18} color={colores.verdeTexto} />
              )}
            </Pressable>
          ))}
        </View>
      )}
      {consulta.cargando || consulta.error ? (
        <EstadoCarga error={consulta.error} alReintentar={consulta.recargar} />
      ) : consulta.datos?.registros.length ? (
        <>
          {consulta.datos.registros.map((viaje) => (
            <TarjetaViaje
              key={viaje.id}
              viaje={viaje}
              alAbrir={() =>
                navegador.push({
                  pathname: "/(chofer)/viaje/[identificador]",
                  params: { identificador: viaje.id },
                })
              }
            />
          ))}
          <Paginador
            pagina={pagina}
            total={consulta.datos.total}
            alCambiar={establecerPagina}
          />
        </>
      ) : (
        <Tarjeta style={estilos.vacio}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              estilos.ilustracion,
              { backgroundColor: colores.verdeSuave },
            ]}
          >
            <Truck size={48} strokeWidth={1.4} color={colores.verdeTexto} />
            <View
              style={[
                estilos.insignia,
                {
                  backgroundColor: colores.tarjeta,
                  borderColor: colores.verdeSuave,
                },
              ]}
            >
              <Check size={17} strokeWidth={2.5} color={colores.verdeTexto} />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Texto tipo="subtitulo" style={{ textAlign: "center" }}>
              {t(estado ? "sinViajesFiltro" : "sinViajes")}
            </Texto>
            <Texto color={colores.secundario} style={{ textAlign: "center" }}>
              {t(estado ? "sinViajesFiltroAyuda" : "sinViajesAyuda")}
            </Texto>
          </View>
          {estado ? (
            <Boton
              titulo={t("verTodosViajes")}
              secundario
              alPulsar={() => {
                establecerEstado("");
                establecerPagina(1);
              }}
            />
          ) : null}
        </Tarjeta>
      )}
      {!consulta.error && !consulta.cargando && (
        <Texto
          tipo="pequeno"
          color={colores.secundario}
          style={{ textAlign: "center", paddingVertical: 4 }}
        >
          {t("deslizarActualizar")}
        </Texto>
      )}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  controles: { flexDirection: "row", alignItems: "center", gap: 10 },
  selector: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  actualizar: {
    width: 48,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filtros: { padding: 6, borderRadius: 16, borderWidth: 1, gap: 2 },
  filtro: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  vacio: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    gap: 22,
  },
  ilustracion: {
    width: 92,
    height: 92,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  insignia: {
    position: "absolute",
    right: -4,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
