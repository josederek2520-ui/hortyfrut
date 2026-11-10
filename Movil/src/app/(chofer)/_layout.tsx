import { Redirect, Stack } from "expo-router";
import { usarSesion } from "@/modulos/sesion/presentacion/ProveedorSesion";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { Pantalla, EstadoCarga } from "@/compartido/componentes/Elementos";
export default function DisposicionChofer() {
  const { fase, servicio } = usarSesion(),
    { colores, reducirMovimiento } = usarInterfaz();
  if (fase === "anonima") return <Redirect href="/iniciar-sesion" />;
  if (fase !== "autenticada")
    return (
      <Pantalla titulo="HortyFru">
        <EstadoCarga
          error={fase === "error" ? new Error() : undefined}
          alReintentar={() => void servicio.restaurar()}
        />
      </Pantalla>
    );
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
