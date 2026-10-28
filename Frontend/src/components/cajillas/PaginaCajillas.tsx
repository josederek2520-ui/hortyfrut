import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionCajillas from "./GestionCajillas";
import FichaCajilla from "./FichaCajilla";
import type { TipoMovimientoCajilla } from "./tipos";

export async function metadatosCajillas(clave = "titulo") {
  const t = await getTranslations("cajillas");
  return { title: `${t(clave)} | HortyFru`, description: t("subtitulo") };
}
export default async function PaginaCajillas({
  idioma,
  modo = "listado",
  identificador,
  tipo,
  sucursalInicial,
}: {
  idioma: string;
  modo?: "listado" | "nuevo" | "detalle" | "movimiento";
  identificador?: string;
  tipo?: TipoMovimientoCajilla;
  sucursalInicial?: number;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await obtenerSesion();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  return modo === "listado" ? (
    <GestionCajillas sesion={sesion!} />
  ) : (
    <FichaCajilla
      key={`${modo}-${identificador || "nuevo"}-${tipo || ""}`}
      sesion={sesion!}
      modo={modo}
      identificador={identificador}
      tipo={tipo}
      sucursalInicial={sucursalInicial}
    />
  );
}
