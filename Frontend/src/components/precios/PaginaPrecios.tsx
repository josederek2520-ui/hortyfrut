import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import ListaPrecios from "./ListaPrecios";
import HojaPrecio from "./HojaPrecio";

export async function metadatosPrecios() {
  const t = await getTranslations("precios");
  return { title: t("titulo") + " | HortyFru", description: t("subtitulo") };
}
export default async function PaginaPrecios({
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
  const t = await getTranslations("precios");
  if (
    sesion!.acceso_publico ||
    !sesion!.permisos_precios?.ver ||
    (modo === "nueva" && !sesion!.permisos_precios?.crear)
  )
    return <p role="alert">{t("sinPermiso")}</p>;
  if (
    modo === "detalle" &&
    (!identificador || !/^[1-9]\d{0,14}$/.test(identificador))
  )
    return <p role="alert">{t("sinAcceso")}</p>;
  return modo === "listado" ? (
    <ListaPrecios key={sesion!.user.id} sesion={sesion!} />
  ) : (
    <HojaPrecio
      key={sesion!.user.id + "-" + (identificador ?? "nueva")}
      sesion={sesion!}
      identificador={identificador ? Number(identificador) : undefined}
    />
  );
}
