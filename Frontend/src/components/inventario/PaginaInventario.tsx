import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionInventario from "./GestionInventario";
import FichaInventario from "./FichaInventario";

export async function metadatosInventario(tipo: "lotes" | "movimientos") {
  const t = await getTranslations("inventario");
  return {
    title: `${t(tipo === "lotes" ? "lotesTitulo" : "movimientosTitulo")} | HortyFru`,
    description: t(tipo === "lotes" ? "lotesAyuda" : "movimientosAyuda"),
  };
}
export default async function PaginaInventario({
  idioma,
  tipo,
  identificador,
}: {
  idioma: string;
  tipo: "lotes" | "movimientos";
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
  return identificador ? (
    <FichaInventario
      key={`${tipo}-${identificador}`}
      tipo={tipo}
      identificador={identificador}
      sesion={sesion!}
    />
  ) : (
    <GestionInventario tipo={tipo} sesion={sesion!} />
  );
}
