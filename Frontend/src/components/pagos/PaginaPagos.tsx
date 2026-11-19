import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth-server";
import { redirect } from "@/i18n/navigation";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import HojaCobro from "@/components/cobros/HojaCobro";
import PanelMisPagos from "./PanelMisPagos";
import ListadoPagos from "./ListadoPagos";
import DetallePago from "./DetallePago";

export async function metadatosPagos() {
  const t = await getTranslations("pagos");
  return { title: t("titulo") + " | HortyFru", description: t("subtitulo") };
}
export default async function PaginaPagos({
  idioma,
  oficina = false,
  modo = "listado",
  identificador,
}: {
  idioma: string;
  oficina?: boolean;
  modo?: "listado" | "nuevo" | "detalle";
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
  const t = await getTranslations("comercialComun");
  if (
    oficina
      ? sesion!.acceso_publico || !sesion!.permisos_pagos?.ver
      : !sesion!.permisos_mis_pagos?.ver ||
        (modo === "nuevo" && !sesion!.permisos_mis_pagos.informar)
  )
    return <p role="alert">{t("sinAcceso")}</p>;
  if (
    modo === "detalle" &&
    (!identificador || !/^[1-9]\d{0,14}$/.test(identificador))
  )
    return <p role="alert">{t("sinAcceso")}</p>;
  const clave = `${sesion!.user.id}-${oficina}-${identificador ?? modo}-${sesion!.cliente_pagos?.id ?? ""}`;
  if (modo === "nuevo")
    return (
      <HojaCobro
        key={clave}
        supermercado
        clienteInicial={sesion!.cliente_pagos}
      />
    );
  if (modo === "detalle")
    return (
      <DetallePago
        key={clave}
        identificador={Number(identificador)}
        oficina={oficina}
        puedeConfirmar={sesion!.permisos_pagos?.confirmar}
        puedeObservar={sesion!.permisos_pagos?.observar}
        puedeInformar={sesion!.permisos_mis_pagos?.informar}
        puedeVerCobros={sesion!.permisos_cobros?.ver}
      />
    );
  return oficina ? (
    <ListadoPagos key={clave} oficina />
  ) : (
    <PanelMisPagos
      key={clave}
      puedeInformar={!!sesion!.permisos_mis_pagos?.informar}
    />
  );
}
