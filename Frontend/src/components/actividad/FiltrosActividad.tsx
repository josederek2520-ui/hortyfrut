"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import {
  SearchIcon as IconoBuscar,
  FilterLinesIcon as IconoFiltros,
  IconoActualizar,
} from "@/icons";
import {
  FILTROS_VACIOS,
  type FiltrosActividad as DatosFiltros,
  type OpcionesActividad,
} from "./tipos";

interface Propiedades {
  buscar: string;
  filtros: DatosFiltros;
  opciones: OpcionesActividad;
  cargando: boolean;
  alBuscar: (valor: string) => void;
  alFiltrar: (filtros: DatosFiltros) => void;
  alActualizar: () => void;
}
export default function FiltrosActividad({
  buscar,
  filtros,
  opciones,
  cargando,
  alBuscar,
  alFiltrar,
  alActualizar,
}: Propiedades) {
  const t = useTranslations("actividad");
  const [abierto, establecerAbierto] = useState(false);
  const [borrador, establecerBorrador] = useState(filtros);
  const [error, establecerError] = useState("");
  const cantidad = Object.values(filtros).filter(Boolean).length;
  const cambiar = (campo: keyof DatosFiltros, valor: string) => {
    establecerBorrador((actual) => ({ ...actual, [campo]: valor }));
    establecerError("");
  };
  const aplicar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (borrador.desde && borrador.hasta && borrador.desde > borrador.hasta) {
      establecerError(t("fechasInvalidas"));
      return;
    }
    alFiltrar(borrador);
    establecerAbierto(false);
  };
  const claseSelector =
    "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <IconoBuscar className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-gray-400 dark:text-gray-500" />
          <Input
            type="search"
            value={buscar}
            maxLength={150}
            onChange={(evento) => alBuscar(evento.target.value)}
            placeholder={t("buscar")}
            aria-label={t("buscar")}
            className="ps-10"
          />
        </div>
        <div className="flex gap-3 sm:ms-auto">
          <Button
            size="sm"
            variant="outline"
            aria-expanded={abierto}
            aria-controls="filtros-actividad"
            onClick={() => {
              establecerBorrador(filtros);
              establecerError("");
              establecerAbierto(!abierto);
            }}
            startIcon={<IconoFiltros className="size-4.5" />}
          >
            {t("filtros")}
            {cantidad > 0 && (
              <span className="rounded-full bg-brand-50 px-1.5 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                {cantidad}
              </span>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={cargando}
            onClick={alActualizar}
            startIcon={
              <IconoActualizar
                className={`size-4 ${cargando ? "motion-safe:animate-spin" : ""}`}
              />
            }
          >
            {t("actualizar")}
          </Button>
        </div>
      </div>
      {abierto && (
        <form
          id="filtros-actividad"
          noValidate
          onSubmit={aplicar}
          className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-800/40"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <Label htmlFor="actividad-modulo">{t("modulo")}</Label>
              <select
                id="actividad-modulo"
                value={borrador.modulo}
                onChange={(evento) => cambiar("modulo", evento.target.value)}
                className={claseSelector}
              >
                <option value="">{t("todosModulos")}</option>
                {opciones.modulos.map((modulo) => (
                  <option key={modulo} value={modulo}>
                    {t.has(`modulos.${modulo}`)
                      ? t(`modulos.${modulo}`)
                      : modulo.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="actividad-accion">{t("accion")}</Label>
              <select
                id="actividad-accion"
                value={borrador.accion}
                onChange={(evento) => cambiar("accion", evento.target.value)}
                className={claseSelector}
              >
                <option value="">{t("todasAcciones")}</option>
                {opciones.acciones.map((accion) => (
                  <option key={accion} value={accion}>
                    {t.has(`acciones.${accion}`)
                      ? t(`acciones.${accion}`)
                      : accion.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="actividad-responsable">{t("responsable")}</Label>
              <Input
                id="actividad-responsable"
                value={borrador.responsable}
                maxLength={150}
                placeholder={t("nombreResponsable")}
                onChange={(evento) =>
                  cambiar("responsable", evento.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="actividad-desde">{t("desde")}</Label>
              <CampoFecha
                id="actividad-desde"
                value={borrador.desde}
                max={borrador.hasta || undefined}
                alCambiar={(fecha) => cambiar("desde", fecha)}
                error={!!error}
                aria-invalid={!!error}
                aria-describedby={error ? "error-fechas-actividad" : undefined}
              />
            </div>
            <div>
              <Label htmlFor="actividad-hasta">{t("hasta")}</Label>
              <CampoFecha
                id="actividad-hasta"
                value={borrador.hasta}
                min={borrador.desde || undefined}
                alCambiar={(fecha) => cambiar("hasta", fecha)}
                error={!!error}
                aria-invalid={!!error}
                aria-describedby={error ? "error-fechas-actividad" : undefined}
              />
            </div>
          </div>
          {error && (
            <p
              id="error-fechas-actividad"
              role="alert"
              className="mt-3 text-sm text-error-500"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                establecerBorrador(FILTROS_VACIOS);
                alFiltrar(FILTROS_VACIOS);
                establecerAbierto(false);
              }}
            >
              {t("limpiarFiltros")}
            </Button>
            <Button size="sm" type="submit">
              {t("aplicar")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
