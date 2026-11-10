import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionVehiculos from "@/components/vehiculos/GestionVehiculos";
import FichaVehiculo from "@/components/vehiculos/FichaVehiculo";
import GestionDespachos from "@/components/despachos/GestionDespachos";
import FichaDespacho from "@/components/despachos/FichaDespacho";

export async function metadatosLogistica(modulo: "vehiculos" | "despachos") {
  const t = await getTranslations(modulo);
  return { title: `${t("titulo")} | HortyFru`, description: t("subtitulo") };
}

export default async function PaginaLogistica({
  idioma,
  modulo,
  modo = "listado",
  identificador,
}: {
  idioma: string;
  modulo: "vehiculos" | "despachos";
  modo?: "listado" | "nuevo" | "editar" | "detalle";
  identificador?: string;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await obtenerSesion();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  if (modulo === "vehiculos")
    return modo === "listado" ? (
      <GestionVehiculos sesion={sesion!} />
    ) : (
      <FichaVehiculo
        sesion={sesion!}
        modo={modo}
        identificador={identificador}
      />
    );
  return modo === "listado" ? (
    <GestionDespachos sesion={sesion!} />
  ) : (
    <FichaDespacho sesion={sesion!} modo={modo} identificador={identificador} />
  );
}
