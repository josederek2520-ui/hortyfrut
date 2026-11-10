import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import ListaDevoluciones from "./ListaDevoluciones";
import HojaDevolucion from "./HojaDevolucion";

export async function metadatosDevoluciones() {
  const t = await getTranslations("devoluciones");
  return { title: t("titulo") + " | HortyFru", description: t("subtitulo") };
}
export function identificadorDevolucion(valor?: string | string[]) {
  return typeof valor === "string" &&
    /^[1-9]\d{0,14}$/.test(valor) &&
    Number.isSafeInteger(Number(valor))
    ? Number(valor)
    : undefined;
}
export default async function PaginaDevoluciones({
  idioma,
  modo = "listado",
  identificador,
  entrega,
}: {
  idioma: string;
  modo?: "listado" | "nueva" | "detalle";
  identificador?: string;
  entrega?: string | string[];
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await getSession();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  const t = await getTranslations("devoluciones");
  if (
    sesion!.acceso_publico ||
    !sesion!.permisos_devoluciones?.ver ||
    (modo === "nueva" && !sesion!.permisos_devoluciones?.crear)
  )
    return <p role="alert">{t("sinPermiso")}</p>;
  const id = identificadorDevolucion(identificador),
    origen = identificadorDevolucion(entrega);
  if ((modo === "detalle" && !id) || (entrega !== undefined && !origen))
    return <p role="alert">{t("sinAcceso")}</p>;
  return modo === "listado" ? (
    <ListaDevoluciones
      key={sesion!.user.id + "-" + (origen ?? "todas")}
      sesion={sesion!}
      entregaInicial={origen}
    />
  ) : (
    <HojaDevolucion
      key={sesion!.user.id + "-" + (id ?? "nueva") + "-" + (origen ?? "")}
      sesion={sesion!}
      identificador={id}
      entregaInicial={origen}
    />
  );
}
