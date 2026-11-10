import { Redirect } from "expo-router";
import { usarSesion } from "@/modulos/sesion/presentacion/ProveedorSesion";
import { Pantalla, EstadoCarga } from "@/compartido/componentes/Elementos";
export default function Inicio() {
  const { fase, servicio } = usarSesion();
  if (fase === "iniciando" || fase === "error")
    return (
      <Pantalla titulo="HortyFru">
        <EstadoCarga
          error={fase === "error" ? new Error() : undefined}
          alReintentar={() => void servicio.restaurar()}
        />
      </Pantalla>
    );
  return (
    <Redirect
      href={fase === "autenticada" ? "/(chofer)/viajes" : "/iniciar-sesion"}
    />
  );
}
