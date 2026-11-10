import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  ProveedorInterfaz,
  usarInterfaz,
} from "@/compartido/tema/ProveedorInterfaz";
import { ProveedorSesion } from "@/modulos/sesion/presentacion/ProveedorSesion";
import VigilanciaSeguimiento from "@/modulos/seguimiento/presentacion/VigilanciaSeguimiento";

function Navegacion() {
  const { colores, reducirMovimiento } = usarInterfaz();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reducirMovimiento ? "none" : "slide_from_right",
        contentStyle: { backgroundColor: colores.fondo },
      }}
    />
  );
}
export default function DisposicionRaiz() {
  return (
    <SafeAreaProvider>
      <ProveedorInterfaz>
        <ProveedorSesion>
          <VigilanciaSeguimiento />
          <Navegacion />
        </ProveedorSesion>
      </ProveedorInterfaz>
    </SafeAreaProvider>
  );
}
