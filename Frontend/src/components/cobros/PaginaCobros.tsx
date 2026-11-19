import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth-server";
import { redirect } from "@/i18n/navigation";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import ListaCobros from "./ListaCobros";
import HojaCobro from "./HojaCobro";
import DetalleCobro from "./DetalleCobro";

export async function metadatosCobros() {
  const t = await getTranslations("cobros");
  return { title: t("titulo") + " | HortyFru", description: t("subtitulo") };
}
export default async function PaginaCobros({
  idioma,
  modo = "listado",
  identificador,
  venta,
}: {
  idioma: string;
  modo?: "listado" | "nuevo" | "detalle";
  identificador?: string;
  venta?: string;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await getSession();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  const t = await getTranslations("comercialComun");
  if (
    sesion!.acceso_publico ||
    !sesion!.permisos_cobros?.ver ||
    (modo === "nuevo" && !sesion!.permisos_cobros?.registrar)
  )
    return <p role="alert">{t("sinAcceso")}</p>;
  if (
    modo === "detalle" &&
    (!identificador || !/^[1-9]\d{0,14}$/.test(identificador))
  )
    return <p role="alert">{t("sinAcceso")}</p>;
  const clave = sesion!.user.id + "-" + (identificador ?? modo);
  return modo === "listado" ? (
    <ListaCobros
      key={clave}
      puedeRegistrar={!!sesion!.permisos_cobros?.registrar}
      venta={venta && /^[1-9]\d{0,14}$/.test(venta) ? venta : undefined}
    />
  ) : modo === "nuevo" ? (
    <HojaCobro key={clave} />
  ) : (
    <DetalleCobro
      key={clave}
      identificador={Number(identificador)}
      puedeVerVentas={!!sesion!.permisos_ventas?.ver}
    />
  );
}
