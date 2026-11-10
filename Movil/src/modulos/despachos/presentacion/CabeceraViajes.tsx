import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { MarcaHortyfru, Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";

export function CabeceraViajes({ nombre }: { nombre: string }) {
  const { colores, t } = usarInterfaz(),
    navegador = useRouter();
  const nombres = nombre.trim().split(/\s+/).filter(Boolean);
  const iniciales = nombres
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toLocaleUpperCase();
  return (
    <View style={estilos.cabecera}>
      <MarcaHortyfru compacta />
      <Pressable
        accessibilityLabel={t("verCuenta")}
        accessibilityRole="button"
        onPress={() => navegador.navigate("/(chofer)/cuenta")}
        style={({ pressed }) => [
          estilos.cuenta,
          { opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <View style={estilos.saludo}>
          <Texto
            tipo="pequeno"
            style={{ fontWeight: "600", textAlign: "right" }}
          >
            {t("saludo", { nombre: nombres[0] ?? "" })}
          </Texto>
          <Texto tipo="pequeno" color={colores.secundario}>
            {t("chofer")}
          </Texto>
        </View>
        <View
          style={[
            estilos.avatar,
            { backgroundColor: colores.verdeSuave, borderColor: colores.borde },
          ]}
        >
          <Texto
            tipo="pequeno"
            color={colores.verdeTexto}
            style={{ fontWeight: "700" }}
          >
            {iniciales}
          </Texto>
        </View>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecera: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  cuenta: {
    flexShrink: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  saludo: { alignItems: "flex-end", flexShrink: 1 },
  avatar: {
    width: 40,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
});
