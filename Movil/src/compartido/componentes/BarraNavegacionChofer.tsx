import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Truck, UserRound } from "lucide-react-native";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { Texto } from "./Elementos";

export function BarraNavegacionChofer({
  actual,
}: {
  actual: "viajes" | "cuenta";
}) {
  const { colores, t } = usarInterfaz(),
    navegador = useRouter();
  return (
    <View style={estilos.barra} accessibilityRole="tablist">
      {(["viajes", "cuenta"] as const).map((destino) => {
        const seleccionada = destino === actual;
        const Icono = destino === "viajes" ? Truck : UserRound;
        return (
          <Pressable
            key={destino}
            accessibilityRole="tab"
            accessibilityState={{ selected: seleccionada }}
            accessibilityLabel={t(destino)}
            onPress={() => {
              if (!seleccionada)
                navegador.navigate(
                  destino === "viajes"
                    ? "/(chofer)/viajes"
                    : "/(chofer)/cuenta",
                );
            }}
            style={({ pressed }) => [
              estilos.destino,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <View
              style={[
                estilos.icono,
                {
                  backgroundColor: seleccionada
                    ? colores.verdeSuave
                    : "transparent",
                },
              ]}
            >
              <Icono
                size={22}
                color={seleccionada ? colores.verdeTexto : colores.secundario}
                strokeWidth={seleccionada ? 2.2 : 1.7}
              />
            </View>
            <Texto
              tipo="pequeno"
              color={seleccionada ? colores.verdeTexto : colores.secundario}
              style={{ fontWeight: seleccionada ? "700" : "500" }}
            >
              {t(destino)}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: "row", gap: 16 },
  destino: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  icono: {
    minWidth: 60,
    height: 32,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
