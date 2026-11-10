"use client";
import { useTranslations } from "next-intl";
import {
  ClipboardList as IconoPedido,
  Warehouse as IconoAlmacen,
  Truck as IconoReparto,
  MapPin as IconoSucursal,
  PackageCheck as IconoPreparacion,
  ArrowRight as IconoAvance,
  Leaf as IconoProducto,
} from "lucide-react";
import MarcaHortyfru from "@/components/common/MarcaHortyfru";
import estilos from "./estilosAcceso.module.css";

export default function PresentacionAcceso() {
  const t = useTranslations("users.auth");
  const pasos = [
    { texto: "pasoPedido", icono: IconoPedido },
    { texto: "pasoAlmacen", icono: IconoAlmacen },
    { texto: "pasoReparto", icono: IconoReparto },
    { texto: "pasoSucursal", icono: IconoSucursal },
  ];
  const funciones = [
    { titulo: "pedidosTitulo", ayuda: "pedidosAyuda", icono: IconoPedido },
    {
      titulo: "inventarioTitulo",
      ayuda: "inventarioAyuda",
      icono: IconoPreparacion,
    },
    { titulo: "entregasTitulo", ayuda: "entregasAyuda", icono: IconoReparto },
  ];
  return (
    <aside
      className={`${estilos.presentacion} relative hidden min-w-0 flex-col justify-between gap-10 overflow-hidden rounded-3xl border p-8 lg:flex xl:p-12`}
      aria-labelledby="titulo-presentacion-acceso"
    >
      <div className="pe-12">
        <MarcaHortyfru sobreOscuro />
      </div>
      <div className="relative max-w-xl space-y-8">
        <div>
          <p className="mb-4 text-xs font-semibold tracking-widest text-brand-200 uppercase">
            {t("brandTag")}
          </p>
          <h2
            id="titulo-presentacion-acceso"
            className={`${estilos.titulo} font-semibold text-white`}
          >
            {t("brandTitle")}
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-brand-100">
            {t("brandDescription")}
          </p>
        </div>
        <div className={estilos.recorrido}>
          <p className="mb-5 text-xs font-medium text-brand-100">
            {t("pasosOperacion")}
          </p>
          <ol className="grid grid-cols-4 gap-3">
            {pasos.map(({ texto, icono: Icono }, indice) => (
              <li key={texto} className="relative min-w-0 text-center">
                <span className="relative z-1 mx-auto flex size-12 items-center justify-center rounded-2xl border border-brand-300/40 bg-brand-950 text-brand-100">
                  <Icono className="size-5" aria-hidden="true" />
                </span>
                {indice < pasos.length - 1 && (
                  <IconoAvance
                    className="absolute -end-3 top-4 size-4 text-brand-200 rtl:rotate-180"
                    aria-hidden="true"
                  />
                )}
                <span className="mt-3 block text-xs font-medium break-words text-white">
                  {t(texto)}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <ul className="space-y-5">
          {funciones.map(({ titulo, ayuda, icono: Icono }) => (
            <li key={titulo} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-brand-100">
                <Icono className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{t(titulo)}</p>
                <p className="mt-1 text-sm leading-5 text-brand-100">
                  {t(ayuda)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="flex items-center gap-2 text-xs text-brand-100">
        <IconoProducto className="size-4 shrink-0" aria-hidden="true" />
        {t("operacionConectada")}
      </p>
    </aside>
  );
}
