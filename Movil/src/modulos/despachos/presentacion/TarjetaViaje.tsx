import { StyleSheet, View } from "react-native";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Truck,
  Weight,
} from "lucide-react-native";
import { Boton, Tarjeta, Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import type { Viaje } from "../dominio/Viaje";
import { cantidad, etiquetaEstado, fechaCorta } from "./formatos";

export function TarjetaViaje({
  viaje,
  alAbrir,
}: {
  viaje: Viaje;
  alAbrir: () => void;
}) {
  const { colores, idioma, oscuro, t } = usarInterfaz();
  const completado = viaje.estado === "finalizado";
  const cancelado = viaje.estado === "cancelado";
  const pendiente = viaje.estado === "borrador";
  const fondoEstado = cancelado
    ? colores.errorFondo
    : completado
      ? colores.neutroFondo
      : pendiente
        ? colores.pendienteFondo
        : colores.verdeSuave;
  const textoEstado = cancelado
    ? colores.error
    : completado
      ? colores.secundario
      : pendiente
        ? colores.pendienteTexto
        : colores.verdeTexto;
  const avance = viaje.resumen.pedidos
    ? Math.min(
        100,
        (100 * viaje.resumen.pedidosDescargados) / viaje.resumen.pedidos,
      )
    : 0;
  return (
    <Tarjeta
      style={{
        shadowColor: colores.sombra,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: oscuro ? 0 : 0.045,
        shadowRadius: 12,
        elevation: oscuro ? 0 : 1,
        gap: 10,
        padding: 16,
      }}
    >
      <View style={estilos.cabecera}>
        <View style={[estilos.estado, { backgroundColor: fondoEstado }]}>
          <Texto
            tipo="pequeno"
            color={textoEstado}
            style={{ fontWeight: "700" }}
          >
            {t(etiquetaEstado(viaje.estado))}
          </Texto>
        </View>
        <Texto
          tipo="pequeno"
          color={colores.secundario}
          style={{ fontWeight: "600", flexShrink: 1 }}
        >
          {viaje.codigo}
        </Texto>
      </View>
      <View style={estilos.destino}>
        <View style={{ flex: 1, gap: 3 }}>
          <Texto tipo="pequeno" color={colores.secundario}>
            {t(viaje.siguienteDestino ? "proximaSucursal" : "salidaDesde")}
          </Texto>
          <Texto tipo="subtitulo">
            {viaje.siguienteDestino?.sucursal ?? viaje.almacen}
          </Texto>
          {viaje.siguienteDestino && (
            <Texto tipo="pequeno" color={colores.secundario}>
              {viaje.siguienteDestino.cliente}
            </Texto>
          )}
        </View>
        <View
          accessible
          accessibilityLabel={`${t("vehiculoAsignado")}: ${viaje.vehiculo}`}
          style={[estilos.vehiculo, { backgroundColor: colores.verdeSuave }]}
        >
          <Truck size={34} strokeWidth={1.5} color={colores.verdeTexto} />
          <Texto
            tipo="pequeno"
            color={colores.verdeTexto}
            style={{ fontWeight: "600", textAlign: "center" }}
          >
            {viaje.vehiculo}
          </Texto>
        </View>
      </View>
      <View style={estilos.datos}>
        <View style={estilos.dato}>
          <MapPin size={15} color={colores.secundario} />
          <Texto tipo="pequeno">
            {t("destinos", { cantidad: viaje.resumen.paradas })}
          </Texto>
        </View>
        <View style={estilos.dato}>
          <Weight size={15} color={colores.secundario} />
          <Texto tipo="pequeno">
            {cantidad(viaje.resumen.pesoKg, idioma)} kg
          </Texto>
        </View>
        <View style={estilos.dato}>
          <CalendarDays size={15} color={colores.secundario} />
          <Texto tipo="pequeno">{fechaCorta(viaje.fechaReparto, idioma)}</Texto>
        </View>
      </View>
      <View style={{ gap: 7 }}>
        <Texto tipo="pequeno" color={colores.secundario}>
          {t("pedidosDescargados", {
            descargados: viaje.resumen.pedidosDescargados,
            total: viaje.resumen.pedidos,
          })}
        </Texto>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t("pedidosDescargados", {
            descargados: viaje.resumen.pedidosDescargados,
            total: viaje.resumen.pedidos,
          })}
          accessibilityValue={{
            min: 0,
            max: Math.max(1, viaje.resumen.pedidos),
            now: viaje.resumen.pedidosDescargados,
          }}
          style={[estilos.avance, { backgroundColor: colores.neutroFondo }]}
        >
          <View
            style={{
              width: `${avance}%`,
              height: 4,
              borderRadius: 3,
              backgroundColor: colores.verde,
            }}
          />
        </View>
      </View>
      <Boton
        titulo={t("abrirViaje")}
        alPulsar={alAbrir}
        iconoAlFinal
        icono={<ArrowRight size={18} color={colores.blanco} />}
      />
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  estado: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  destino: { flexDirection: "row", alignItems: "center", gap: 12 },
  vehiculo: {
    width: 84,
    minHeight: 72,
    padding: 8,
    gap: 2,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  datos: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 8 },
  dato: { flexDirection: "row", alignItems: "center", gap: 5 },
  avance: { height: 4, borderRadius: 3, overflow: "hidden" },
});
