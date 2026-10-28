"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ChevronLeftIcon as IconoVolver, IconoProducto } from "@/icons";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { focusInvalidField as enfocarCampoInvalido } from "@/lib/form-validation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import SelectorCatalogo from "./SelectorCatalogo";
import CampoImagenProducto from "./CampoImagenProducto";
import type { Producto, OpcionCatalogo } from "./tipos";

export default function FormularioProducto({
  producto,
  alError,
  alRecargar,
}: {
  producto: Producto | null;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("productos");
  const navegador = useRouter();
  const [nombre, establecerNombre] = useState(producto?.nombre || "");
  const [categoria, establecerCategoria] = useState<OpcionCatalogo | null>(
    producto?.categoria || null,
  );
  const [unidad, establecerUnidad] = useState<OpcionCatalogo | null>(
    producto?.unidad_medida || null,
  );
  const [imagen, establecerImagen] = useState<File | null>(null);
  const [quitarImagen, establecerQuitarImagen] = useState(false);
  const [problemaImagen, establecerProblemaImagen] = useState("");
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacionFormulario();
  const modificado =
    nombre !== (producto?.nombre || "") ||
    (categoria?.id || null) !== (producto?.categoria?.id || null) ||
    (unidad?.id || null) !== (producto?.unidad_medida?.id || null) ||
    !!imagen ||
    quitarImagen;
  useEffect(() => {
    if (!modificado) return;
    const avisarSalida = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisarSalida);
    return () => window.removeEventListener("beforeunload", avisarSalida);
  }, [modificado]);
  const cancelar = () => {
    if (!modificado || window.confirm(t("descartar")))
      navegador.push("/productos");
  };
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (guardando) return;
    const formulario = evento.currentTarget;
    const valido = validarFormulario(formulario);
    if (!valido || problemaImagen) {
      enfocarCampoInvalido(formulario);
      alError(new ErrorApi(400));
      return;
    }
    establecerGuardando(true);
    establecerFallo("");
    establecerConflicto(false);
    try {
      const datos = new FormData();
      datos.set("nombre", nombre.trim());
      datos.set("categoria", String(categoria!.id));
      datos.set("unidad_medida", String(unidad!.id));
      if (producto) datos.set("version", producto.version);
      if (imagen) datos.set("imagen", imagen);
      if (quitarImagen) datos.set("quitar_imagen", "true");
      const guardado = await api<Producto>(
        producto ? `productos/${producto.id}/` : "productos/",
        {
          method: producto ? "PATCH" : "POST",
          body: datos,
        },
      );
      sessionStorage.setItem(
        "catalogos:productos:aviso",
        producto ? "editado" : "creado",
      );
      navegador.push(producto ? "/productos" : `/productos/${guardado.id}`);
      navegador.refresh();
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocarCampoInvalido(formulario);
      }
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        t(
          error instanceof ErrorApi && error.status === 409
            ? "conflicto"
            : error instanceof ErrorApi && error.status === 400
              ? "validacion"
              : "errorGuardar",
        ),
      );
      alError(error);
    } finally {
      establecerGuardando(false);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <button
          type="button"
          disabled={guardando}
          onClick={cancelar}
          className="mb-5 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4 rtl:rotate-180" />
          {t("volver")}
        </button>
        <MigasPagina pageTitle={t(producto ? "editar" : "nuevo")} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("subtituloFormulario")}
        </p>
      </div>
      <form
        noValidate
        onSubmit={enviar}
        aria-busy={guardando}
        className="superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 p-6 dark:border-gray-800">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <IconoProducto className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t("datosGenerales")}
            </h2>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("obligatorios")}
            </p>
          </div>
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          {fallo && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
            >
              <p>{fallo}</p>
              {conflicto && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    if (window.confirm(t("confirmarRecarga"))) alRecargar();
                  }}
                >
                  {t("recargar")}
                </Button>
              )}
            </div>
          )}
          <div className="grid items-start gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div>
                <Label htmlFor="producto-nombre">
                  {t("nombre")} <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="producto-nombre"
                  name="nombre"
                  required
                  maxLength={100}
                  value={nombre}
                  disabled={guardando}
                  placeholder={t("ejemploNombre")}
                  onChange={(evento) => {
                    establecerNombre(evento.target.value);
                    cambiarCampo(evento.currentTarget);
                  }}
                  onBlur={(evento) => salirCampo(evento.currentTarget)}
                  error={!!errores.nombre?.length}
                  aria-describedby={
                    errores.nombre?.length ? "producto-nombre-error" : undefined
                  }
                />
                {!!errores.nombre?.length && (
                  <p
                    id="producto-nombre-error"
                    className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
                  >
                    {errores.nombre.join(" ")}
                  </p>
                )}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectorCatalogo
                  tipo="categorias_productos"
                  nombre="categoria"
                  etiqueta={t("categoria")}
                  valor={categoria}
                  alCambiar={(valor) => {
                    establecerCategoria(valor);
                    establecerErrores((actual) => ({
                      ...actual,
                      categoria: [],
                    }));
                  }}
                  error={errores.categoria?.join(" ")}
                  obligatorio
                  deshabilitado={guardando}
                />
                <SelectorCatalogo
                  tipo="unidades_medida"
                  nombre="unidad_medida"
                  etiqueta={t("unidadMedida")}
                  valor={unidad}
                  alCambiar={(valor) => {
                    establecerUnidad(valor);
                    establecerErrores((actual) => ({
                      ...actual,
                      unidad_medida: [],
                    }));
                  }}
                  error={errores.unidad_medida?.join(" ")}
                  obligatorio
                  deshabilitado={guardando}
                />
              </div>
              <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("ayudaCatalogos")}
              </p>
              {!producto && (
                <p className="text-theme-xs leading-5 text-brand-600 dark:text-brand-300">
                  {t("presentacionesDespues")}
                </p>
              )}
              {((categoria && !categoria.activo) ||
                (unidad && !unidad.activo)) && (
                <p className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                  {t("relacionInactiva")}
                </p>
              )}
            </div>
            <aside className="space-y-5">
              <CampoImagenProducto
                origen={producto?.imagen || null}
                nombre={nombre}
                archivo={imagen}
                quitar={quitarImagen}
                alCambiar={(archivo, quitar) => {
                  establecerImagen(archivo);
                  establecerQuitarImagen(quitar);
                  establecerErrores((actual) => ({ ...actual, imagen: [] }));
                }}
                alValidar={establecerProblemaImagen}
                error={problemaImagen || errores.imagen?.join(" ")}
                deshabilitado={guardando}
              />
              <div className="rounded-xl bg-gray-50 p-5 dark:bg-gray-800/50">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t("unidadBase")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  {t("ayudaUnidad")}
                </p>
              </div>
            </aside>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <span
              className={`rounded-full px-2.5 py-1 text-theme-xs font-medium ${(producto?.activo ?? true) ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}
            >
              {t((producto?.activo ?? true) ? "activo" : "inactivo")}
            </span>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t(producto ? "estadoDesdeListado" : "nuevoActivo")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <Button
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={cancelar}
          >
            {t("cancelar")}
          </Button>
          <Button size="sm" type="submit" disabled={guardando || conflicto}>
            {t(guardando ? "guardando" : producto ? "guardarCambios" : "crear")}
          </Button>
        </div>
      </form>
    </div>
  );
}
