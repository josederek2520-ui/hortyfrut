import { Pressable, ScrollView, View } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
} from "lucide-react-native";
import { Boton, Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import OrdenParadasRuta from "./OrdenParadasRuta";
import type { RutaViaje } from "../dominio/Ruta";

export default function PanelRutaChofer({
  ruta,
  destino,
  expandida,
  alExpandir,
  alOrden,
  ocupado,
  tituloAccion,
  alAccion,
  alNavegar,
  error,
  resumen,
  ordenBloqueado,
  accionBloqueada,
  alCancelarCalculo,
  alCalcularOrden,
  alOptimizar,
}: {
  ruta: RutaViaje;
  destino: string;
  expandida: boolean;
  alExpandir: () => void;
  alOrden: (orden: number[]) => void;
  ocupado: boolean;
  ordenBloqueado: boolean;
  accionBloqueada: boolean;
  tituloAccion: string;
  alAccion: () => void;
  alNavegar?: () => void;
  error: string;
  resumen: string;
  alCancelarCalculo?: () => void;
  alCalcularOrden?: () => void;
  alOptimizar?: () => void;
}) {
  const { colores, t } = usarInterfaz();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: expandida }}
        accessibilityLabel={t(
          expandida ? "ocultarDetalleMapa" : "mostrarDetalleMapa",
        )}
        onPress={alExpandir}
        style={{
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
          minHeight: 64,
          padding: 12,
        }}
      >
        <MapPin size={24} color={colores.verdeTexto} />
        <View style={{ flex: 1 }}>
          <Texto tipo="pequeno" color={colores.secundario}>
            {t(ruta.preparando ? "prepararRecorrido" : "siguienteParada")}
          </Texto>
          <Texto style={{ fontWeight: "700" }}>{destino}</Texto>
        </View>
        {expandida ? (
          <ChevronDown size={22} color={colores.secundario} />
        ) : (
          <ChevronUp size={22} color={colores.secundario} />
        )}
      </Pressable>
      {!!resumen && (
        <Texto
          tipo="pequeno"
          style={{ paddingHorizontal: 16, paddingBottom: 8 }}
        >
          {resumen}
        </Texto>
      )}
      {ruta.plan?.optimizacion &&
        ruta.estado !== "obsoleta" &&
        ruta.optimizacion?.estado !== "pendiente" &&
        ruta.optimizacion?.estado !== "calculando" && (
          <Texto
            tipo="pequeno"
            color={colores.secundario}
            style={{ paddingHorizontal: 16, paddingBottom: 8 }}
          >
            {ruta.plan.optimizacion.mejoraS > 0
              ? t("mejoraOptimizacion", {
                  minutos:
                    Math.round((ruta.plan.optimizacion.mejoraS / 60) * 10) / 10,
                  porcentaje: ruta.plan.optimizacion.mejoraPorcentaje,
                })
              : t("ordenActualConservado")}
          </Texto>
        )}
      {expandida && (
        <ScrollView
          contentContainerStyle={{
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          {ruta.estado === "pendiente_aprobacion" && (
            <Texto tipo="pequeno" color={colores.secundario}>
              {t("revisarRecorridoCorto")}
            </Texto>
          )}
          {ruta.estado === "obsoleta" && (
            <Texto tipo="pequeno" color={colores.error}>
              {t("rutaObsoletaCorta")}
            </Texto>
          )}
          {!!ruta.faltantes.length && (
            <Texto tipo="pequeno" color={colores.error}>
              {t("faltanUbicacionesRuta", {
                nombres: ruta.faltantes.join(", "),
              })}
            </Texto>
          )}
          {ruta.puedeOrdenar && (
            <OrdenParadasRuta
              ruta={ruta}
              ocupado={ocupado || ordenBloqueado}
              alCambiar={alOrden}
            />
          )}
          {!!ruta.plan && (
            <Texto tipo="pequeno" color={colores.secundario}>
              {t("sinTraficoEnVivo")}
            </Texto>
          )}
          {alNavegar && (
            <Boton
              titulo={t("abrirNavegacion")}
              secundario
              alPulsar={alNavegar}
              icono={<ExternalLink size={17} color={colores.verdeTexto} />}
            />
          )}
          {alCalcularOrden && (
            <Boton
              titulo={t("calcularMiOrden")}
              secundario
              deshabilitado={ocupado}
              alPulsar={alCalcularOrden}
            />
          )}
          {alOptimizar && (
            <Boton
              titulo={t("optimizarRecorrido")}
              secundario
              deshabilitado={ocupado}
              alPulsar={alOptimizar}
            />
          )}
        </ScrollView>
      )}
      <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 8 }}>
        {!!error && (
          <Texto tipo="pequeno" color={colores.error}>
            {error}
          </Texto>
        )}
        <Boton
          titulo={tituloAccion}
          alPulsar={alAccion}
          ocupado={ocupado}
          deshabilitado={accionBloqueada}
        />
        {alCancelarCalculo && (
          <Boton
            titulo={t("cancelarCalculo")}
            secundario
            deshabilitado={ocupado}
            alPulsar={alCancelarCalculo}
          />
        )}
        <Texto
          tipo="pequeno"
          color={colores.secundario}
          style={{ fontSize: 10, lineHeight: 14, textAlign: "center" }}
        >
          © OpenStreetMap · © OpenMapTiles · OpenFreeMap · OSRM
        </Texto>
      </View>
    </>
  );
}
