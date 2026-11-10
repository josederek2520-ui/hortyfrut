import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import ListaEntregas from "./ListaEntregas";
import HojaRecepcionEntrega from "./HojaRecepcionEntrega";
import DisposicionAplicacion from "@/layout/DisposicionAplicacion";

export async function metadatosEntregas() {
  const t = await getTranslations("entregas");
  return { title: `${t("titulo")} | HortyFru` };
}
export default async function PaginaEntregas({
  idioma,
  despacho,
  pedido,
}: {
  idioma: string;
  despacho?: string;
  pedido?: string;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await getSession();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  if (despacho && pedido) {
    if (
      !/^[1-9]\d{0,14}$/.test(despacho) ||
      !/^[1-9]\d{0,14}$/.test(pedido) ||
      !Number.isSafeInteger(Number(despacho)) ||
      !Number.isSafeInteger(Number(pedido))
    )
      return <ServicioNoDisponible />;
    return (
      <DisposicionAplicacion
        modoChofer={!!sesion!.acceso_publico}
        rutaInicio="/entregas"
      >
        <HojaRecepcionEntrega
          key={`${despacho}-${pedido}-${sesion!.user.id}`}
          sesion={sesion!}
          despacho={Number(despacho)}
          pedido={Number(pedido)}
        />
      </DisposicionAplicacion>
    );
  }
  return (
    <DisposicionAplicacion
      modoChofer={!!sesion!.acceso_publico}
      rutaInicio="/entregas"
    >
      <ListaEntregas sesion={sesion!} />
    </DisposicionAplicacion>
  );
}
