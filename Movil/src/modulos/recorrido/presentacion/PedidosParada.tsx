import { useCallback, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, CircleCheck } from "lucide-react-native";
import type { ViajeDetalle, Parada } from "@/modulos/despachos/dominio/Viaje";
import { repositorioDespachos } from "@/composicion/dependencias";
import { usarConsulta } from "@/compartido/aplicacion/usarConsulta";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import {
  Texto,
  EstadoCarga,
  Paginador,
} from "@/compartido/componentes/Elementos";
import {
  fechaCorta,
  cantidad,
} from "@/modulos/despachos/presentacion/formatos";

export default function PedidosParada({
  viaje,
  parada,
  puedeConfirmar,
}: {
  viaje: ViajeDetalle;
  parada: Parada;
  puedeConfirmar: boolean;
}) {
  const { colores, idioma, t } = usarInterfaz(),
    navegador = useRouter();
  const [pagina, establecerPagina] = useState(1);
  const consultar = useCallback(
    (senal: AbortSignal) =>
      repositorioDespachos.pedidos(viaje.id, parada.id, pagina, senal),
    [viaje.id, parada.id, pagina],
  );
  const consulta = usarConsulta(
    `pedidos:${viaje.id}:${parada.id}:${pagina}`,
    consultar,
  );
  if (consulta.cargando || consulta.error || !consulta.datos)
    return (
      <EstadoCarga error={consulta.error} alReintentar={consulta.recargar} />
    );
  return (
    <View style={{ gap: 14 }}>
      {consulta.datos.registros.map((pedido) => (
        <Pressable
          key={pedido.id}
          accessibilityRole="button"
          onPress={() =>
            navegador.push({
              pathname: "/(chofer)/pedido/[viaje]/[parada]/[pedido]",
              params: { viaje: viaje.id, parada: parada.id, pedido: pedido.id },
            })
          }
          style={{
            gap: 7,
            paddingVertical: 15,
            borderTopWidth: 1,
            borderColor: colores.borde,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Texto style={{ fontWeight: "700", flex: 1 }}>
              {pedido.codigo}
            </Texto>
            {pedido.descargadaEn ? (
              <CircleCheck color={colores.verdeTexto} size={21} />
            ) : (
              <ChevronRight color={colores.secundario} size={21} />
            )}
          </View>
          <Texto tipo="pequeno" color={colores.secundario}>
            {t("paraFecha", {
              fecha: fechaCorta(pedido.fechaRequerida, idioma),
            })}
          </Texto>
          <Texto tipo="pequeno">
            {[
              ...(pedido.cajas ? [t("cajas", { cantidad: pedido.cajas })] : []),
              ...(pedido.unidades
                ? [t("unidades", { cantidad: pedido.unidades })]
                : []),
              `${cantidad(pedido.pesoKg, idioma)} kg`,
            ].join(" · ")}
          </Texto>
          <Texto
            tipo="pequeno"
            color={
              pedido.descargadaEn || puedeConfirmar
                ? colores.verdeTexto
                : colores.secundario
            }
          >
            {t(
              pedido.descargadaEn
                ? "descargado"
                : puedeConfirmar
                  ? "revisarPedido"
                  : "pendiente",
            )}
          </Texto>
        </Pressable>
      ))}
      <Paginador
        pagina={pagina}
        total={consulta.datos.total}
        alCambiar={establecerPagina}
      />
    </View>
  );
}
