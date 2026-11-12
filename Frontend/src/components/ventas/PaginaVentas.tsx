import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import ListaVentas from "./ListaVentas";
import HojaVenta from "./HojaVenta";

export async function metadatosVentas() {
  const t = await getTranslations("ventas");
  return { title: t("titulo") + " | HortyFru", description: t("subtitulo") };
}
export default async function PaginaVentas({
  idioma,
  modo = "listado",
  identificador,
}: {
  idioma: string;
  modo?: "listado" | "nueva" | "detalle";
  identificador?: string;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await getSession();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  const t = await getTranslations("ventas");
  if (
    sesion!.acceso_publico ||
    !sesion!.permisos_ventas?.ver ||
    (modo === "nueva" && !sesion!.permisos_ventas?.crear)
  )
    return <p role="alert">{t("sinPermiso")}</p>;
  if (
    modo === "detalle" &&
    (!identificador || !/^[1-9]\d{0,14}$/.test(identificador))
  )
    return <p role="alert">{t("sinAcceso")}</p>;
  return modo === "listado" ? (
    <ListaVentas key={sesion!.user.id} sesion={sesion!} />
  ) : (
    <HojaVenta
      key={sesion!.user.id + "-" + (identificador ?? "nueva")}
      sesion={sesion!}
      identificador={identificador ? Number(identificador) : undefined}
    />
  );
}
