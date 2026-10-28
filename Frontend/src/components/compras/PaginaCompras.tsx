import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionCompras from "./GestionCompras";
import FichaCompra from "./FichaCompra";

export async function metadatosCompras(
  clave: "titulo" | "nuevaCompra" | "editarCompra" | "detalleCompra",
) {
  const t = await getTranslations("compras");
  return { title: `${t(clave)} | HortyFru`, description: t("subtitulo") };
}

export default async function PaginaCompras({
  idioma,
  modo = "listado",
  identificador,
  fechaInicial,
}: {
  idioma: string;
  modo?: "listado" | "nuevo" | "editar" | "detalle";
  identificador?: string;
  fechaInicial?: string;
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
    <GestionCompras
      key={fechaInicial || "todas"}
      sesion={sesion!}
      fechaInicial={fechaInicial}
    />
  ) : (
    <FichaCompra
      key={`${modo}-${identificador || "nueva"}`}
      sesion={sesion!}
      modo={modo}
      identificador={identificador}
    />
  );
}
