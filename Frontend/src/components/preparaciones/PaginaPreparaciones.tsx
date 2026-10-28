import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionPreparaciones from "./GestionPreparaciones";
import FichaPreparacion from "./FichaPreparacion";
import ImpresionConsolidada from "./ImpresionConsolidada";

export async function metadatosPreparaciones(clave = "titulo") {
  const t = await getTranslations("preparaciones");
  return { title: `${t(clave)} | HortyFru`, description: t("subtitulo") };
}
export default async function PaginaPreparaciones({
  idioma,
  modo = "listado",
  identificador,
  fecha,
  cliente,
  historial,
  confirmarInicial,
  consulta = "",
}: {
  idioma: string;
  modo?: "listado" | "nuevo" | "detalle" | "editar" | "hoja";
  identificador?: string;
  fecha?: string;
  cliente?: number;
  historial?: boolean;
  confirmarInicial?: boolean;
  consulta?: string;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await obtenerSesion();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  if (modo === "listado")
    return <GestionPreparaciones sesion={sesion!} historial={historial} clienteInicial={cliente} fechaInicial={fecha} />;
  if (modo === "hoja") {
    const t = await getTranslations("preparaciones");
    return sesion!.permisos_preparaciones?.ver ? (
      <ImpresionConsolidada consulta={consulta} />
    ) : (
      <p role="alert">{t("restringido")}</p>
    );
  }
  return (
    <FichaPreparacion
      key={`${modo}-${identificador || "nuevo"}`}
      sesion={sesion!}
      modo={modo}
      identificador={identificador}
      fecha={fecha}
      cliente={cliente}
      confirmarInicial={confirmarInicial}
    />
  );
}
