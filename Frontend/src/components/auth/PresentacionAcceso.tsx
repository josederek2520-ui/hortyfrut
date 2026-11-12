"use client";

import { useTranslations } from "next-intl";
import IlustracionAcceso from "./IlustracionAcceso";
import estilos from "./estilosAcceso.module.css";

export default function PresentacionAcceso() {
  const t = useTranslations("users.auth");
  return (
    <aside
      className={`${estilos.presentacion} relative hidden min-w-0 flex-col justify-center overflow-hidden p-10 lg:flex xl:p-12`}
      aria-labelledby="titulo-presentacion-acceso"
    >
      <div className="relative z-1 mx-auto w-full max-w-md">
        <span
          className="mb-6 block h-1 w-10 rounded-full bg-orange-400"
          aria-hidden="true"
        />
        <h2
          id="titulo-presentacion-acceso"
          className={`${estilos.titulo} max-w-sm font-semibold text-white`}
        >
          {t("brandTitle")}
        </h2>
        <p className="mt-4 max-w-sm text-base leading-7 text-brand-100">
          {t("brandDescription")}
        </p>
        <IlustracionAcceso />
      </div>
    </aside>
  );
}
