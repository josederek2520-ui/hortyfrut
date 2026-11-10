import { View } from "react-native";
import { Map } from "lucide-react-native";
import { Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import type { PropiedadesMapa } from "./tiposMapa";

// Expo web es apoyo de desarrollo. El mapa web de negocio vive en Next.js.
export default function MapaRecorrido({
  espacioSuperior,
  espacioInferior,
}: PropiedadesMapa) {
  const { colores, t } = usarInterfaz();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingTop: espacioSuperior,
        paddingBottom: espacioInferior,
        paddingHorizontal: 28,
      }}
    >
      <Map size={42} color={colores.verdeTexto} />
      <Texto style={{ textAlign: "center" }}>{t("mapaSoloAndroid")}</Texto>
    </View>
  );
}
