"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Contenedor from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { LockIcon as IconoCandado } from "@/icons";
import { useModal } from "@/hooks/useModal";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { PermisosCatalogo } from "@/components/catalogos/tipos";
import BarraDirectorio, { CabeceraDirectorio } from "./BarraDirectorio";
import TablaDirectorio from "./TablaDirectorio";
import FormularioSucursal from "./FormularioSucursal";
import ConfirmarEstado from "./ConfirmarEstado";
import type {
  Cliente,
  RegistroDirectorio,
  PaginaDirectorio,
  ResumenDirectorio,
} from "./tipos";

interface Propiedades {
  puedeAsignarEncargado?: boolean;
  cliente?: Cliente;
  permisos: PermisosCatalogo;
  alError: (error: unknown) => void;
  alNotificar: (mensaje: string) => void;
  alRecargarFicha?: () => void;
}

export default function GestionDirectorio({
  puedeAsignarEncargado = false,
  cliente,
  permisos,
  alError,
  alNotificar,
  alRecargarFicha,
}: Propiedades) {
  const t = useTranslations("clientes");
  const navegador = useRouter();
  const modal = useModal();
  const tipo = cliente ? "sucursales" : "clientes";
  const ruta = cliente ? `clientes/${cliente.id}/sucursales` : "clientes";
  const [datos, establecerDatos] = useState<PaginaDirectorio | null>(null);
  const [resumen, establecerResumen] = useState<ResumenDirectorio | null>(null);
  const [buscar, establecerBuscar] = useState("");
  const [estado, establecerEstado] = useState("");
  const [orden, establecerOrden] = useState("nombre");
  const [pagina, establecerPagina] = useState(1);
  const [revision, establecerRevision] = useState(0);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState("");
  const [seleccionado, establecerSeleccionado] =
    useState<RegistroDirectorio | null>(null);
  const [modo, establecerModo] = useState<"formulario" | "estado">(
    "formulario",
  );
  useEffect(() => {
    if (!permisos.ver) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo("");
        try {
          const parametros = new URLSearchParams({
            buscar,
            orden,
            pagina: String(pagina),
          });
          if (estado) parametros.set("activo", estado);
          const [listado, contadores] = await Promise.all([
            api<PaginaDirectorio>(`${ruta}/?${parametros}`, {
              signal: controlador.signal,
            }),
            api<ResumenDirectorio>(
              `${ruta}/resumen/?buscar=${encodeURIComponent(buscar)}`,
              { signal: controlador.signal },
            ),
          ]);
          if (!controlador.signal.aborted) {
            establecerDatos(listado);
            establecerResumen(contadores);
          }
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ErrorApi && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else {
              establecerFallo(
                t(
                  error instanceof ErrorApi && error.status === 403
                    ? "accesoDenegado"
                    : "errorCarga",
                ),
              );
              alError(error);
            }
          }
        } finally {
          if (!controlador.signal.aborted) establecerCargando(false);
        }
      },
      buscar ? 300 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [permisos.ver, ruta, buscar, estado, orden, pagina, revision, t, alError]);
  const abrir = (
    registro: RegistroDirectorio | null,
    modo: "formulario" | "estado",
  ) => {
    establecerSeleccionado(registro);
    establecerModo(modo);
    modal.openModal();
  };
  const crear = () => {
    if (cliente) abrir(null, "formulario");
    else navegador.push("/clientes/nuevo");
  };
  const guardar = () => {
    modal.closeModal();
    establecerSeleccionado(null);
    alNotificar(
      t(
        modo === "estado"
          ? "estadoGuardado"
          : seleccionado
            ? "sucursalEditada"
            : "sucursalCreada",
      ),
    );
    establecerRevision((valor) => valor + 1);
  };
  const recargar = () => {
    modal.closeModal();
    if (alRecargarFicha) alRecargarFicha();
    else establecerRevision((valor) => valor + 1);
  };
  if (!permisos.ver)
    return (
      <section className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <IconoCandado className="size-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {t(`tipos.${tipo}.titulo`)}
          </h2>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {t(cliente ? "sinPermisoSucursales" : "accesoDenegado")}
        </p>
      </section>
    );
  const puedeCrear = permisos.crear && (cliente?.activo ?? true);
  const paginas = Math.max(1, Math.ceil((datos?.count || 0) / 10));
  return (
    <Contenedor
      title={t(`tipos.${tipo}.titulo`)}
      header={
        <div className="space-y-5">
          {cliente && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("sucursales")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("subtituloSucursales")}
              </p>
            </div>
          )}
          <CabeceraDirectorio
            tipo={tipo}
            resumen={resumen}
            estado={estado}
            crear={puedeCrear}
            alEstado={(valor) => {
              establecerEstado(valor);
              establecerPagina(1);
            }}
            alCrear={crear}
          />
        </div>
      }
    >
      {cliente && !cliente.activo && (
        <p className="rounded-xl bg-warning-50 p-4 text-sm leading-6 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
          {t("clienteInactivo")}
        </p>
      )}
      <BarraDirectorio
        tipo={tipo}
        buscar={buscar}
        orden={orden}
        alBuscar={(valor) => {
          establecerBuscar(valor);
          establecerPagina(1);
        }}
        alOrden={(valor) => {
          establecerOrden(valor);
          establecerPagina(1);
        }}
      />
      {(buscar || estado || orden !== "nombre") && (
        <button
          type="button"
          className="rounded text-theme-xs font-medium text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
          onClick={() => {
            establecerBuscar("");
            establecerEstado("");
            establecerOrden("nombre");
            establecerPagina(1);
          }}
        >
          {t("limpiarFiltros")}
        </button>
      )}
      {fallo ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
        >
          <p className="flex-1">{fallo}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => establecerRevision((valor) => valor + 1)}
          >
            {t("reintentar")}
          </Button>
        </div>
      ) : (
        <TablaDirectorio
          tipo={tipo}
          registros={datos?.results || []}
          cargando={cargando}
          filtrado={!!(buscar || estado)}
          permisos={permisos}
          puedeCrear={puedeCrear}
          clienteActivo={cliente?.activo ?? true}
          alCrear={crear}
          alEditar={(registro) => {
            if (cliente) abrir(registro, "formulario");
            else navegador.push(`/clientes/${registro.id}/editar`);
          }}
          alEstado={(registro) => abrir(registro, "estado")}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p
          role="status"
          className="text-theme-xs text-gray-500 dark:text-gray-400"
        >
          {t("paginacion", {
            desde: datos?.count ? (pagina - 1) * 10 + 1 : 0,
            hasta: Math.min(pagina * 10, datos?.count || 0),
            total: datos?.count || 0,
          })}
        </p>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={pagina <= 1 || cargando || !!fallo}
            onClick={() => establecerPagina((valor) => valor - 1)}
          >
            {t("anterior")}
          </Button>
          <span className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
            {pagina} / {paginas}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={pagina >= paginas || cargando || !!fallo}
            onClick={() => establecerPagina((valor) => valor + 1)}
          >
            {t("siguiente")}
          </Button>
        </div>
      </div>
      {modal.isOpen &&
        (modo === "estado" && seleccionado ? (
          <ConfirmarEstado
            registro={seleccionado}
            ruta={ruta}
            alCerrar={modal.closeModal}
            alGuardar={guardar}
            alError={alError}
            alRecargar={recargar}
          />
        ) : cliente && (!seleccionado || "cliente" in seleccionado) ? (
          <FormularioSucursal
            puedeAsignarEncargado={puedeAsignarEncargado}
            cliente={cliente}
            sucursal={seleccionado}
            alCerrar={modal.closeModal}
            alGuardar={guardar}
            alError={alError}
            alRecargar={recargar}
          />
        ) : null)}
    </Contenedor>
  );
}
