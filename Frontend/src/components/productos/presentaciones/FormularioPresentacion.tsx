"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { IconoProducto } from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { focusInvalidField as enfocarCampoInvalido } from "@/lib/form-validation";
import type { Producto, Presentacion, UsoPresentacion } from "../tipos";

interface Propiedades {
  producto: Producto;
  presentacion: Presentacion | null;
  alCerrar: () => void;
  alGuardar: () => void;
  alRecargar: () => void;
  alError: (error: unknown) => void;
}

export default function FormularioPresentacion({
  producto,
  presentacion,
  alCerrar,
  alGuardar,
  alRecargar,
  alError,
}: Propiedades) {
  const t = useTranslations("presentaciones");
  const [nombre, establecerNombre] = useState(presentacion?.nombre || "");
  const [uso, establecerUso] = useState<UsoPresentacion>(
    presentacion?.uso || "ambos",
  );
  const [guardando, establecerGuardando] = useState(false);
  const [columnaPedido, establecerColumnaPedido] = useState(
    presentacion?.columna_pedido || "otra",
  );
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
    columnaPedido !== (presentacion?.columna_pedido || "otra") ||
    nombre !== (presentacion?.nombre || "") ||
    uso !== (presentacion?.uso || "ambos");
  const cerrar = () => {
    if (!guardando && (!modificado || window.confirm(t("descartar"))))
      alCerrar();
  };
  useEffect(() => {
    if (!modificado) return;
    const avisarSalida = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisarSalida);
    return () => window.removeEventListener("beforeunload", avisarSalida);
  }, [modificado]);
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (guardando || conflicto) return;
    const formulario = evento.currentTarget;
    if (!validarFormulario(formulario)) {
      alError(new ErrorApi(400));
      return;
    }
    establecerGuardando(true);
    establecerFallo("");
    try {
      await api(
        `productos/${producto.id}/presentaciones/${presentacion ? `${presentacion.id}/` : ""}`,
        {
          method: presentacion ? "PATCH" : "POST",
          body: JSON.stringify({
            nombre: nombre.trim(),
            uso,
            columna_pedido: uso === "compra" ? "otra" : columnaPedido,
            ...(presentacion ? { version: presentacion.version } : {}),
          }),
        },
      );
      alGuardar();
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocarCampoInvalido(formulario);
      }
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        error instanceof ErrorApi &&
          error.status === 400 &&
          error.errors.detail?.length
          ? error.errors.detail.join(" ")
          : t(
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
  const claseSelector = (campo: string) =>
    `h-11 w-full rounded-lg border px-3 text-sm shadow-theme-xs outline-none focus:ring-3 disabled:opacity-60 ${errores[campo]?.length ? "border-error-500 bg-error-50 text-gray-800 focus:ring-error-500/20 dark:border-error-400 dark:bg-error-500/10 dark:text-gray-100" : "border-gray-300 bg-white text-gray-800 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"}`;
  return (
    <Modal
      isOpen
      onClose={cerrar}
      className="max-w-xl"
      labelledBy="titulo-presentacion"
      closeLabel={t("cerrar")}
    >
      <form
        noValidate
        onSubmit={enviar}
        aria-busy={guardando}
        className="flex max-h-[90dvh] flex-col"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 p-6 pe-16 dark:border-gray-800">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <IconoProducto className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              id="titulo-presentacion"
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              {t(presentacion ? "editar" : "nueva")}
            </h2>
            <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
              {producto.nombre}
            </p>
          </div>
        </div>
        <div className="custom-scrollbar space-y-5 overflow-y-auto p-6">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("obligatorios")}
          </p>
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
          <div>
            <Label htmlFor="presentacion-nombre">
              {t("nombre")} <span className="text-error-500">*</span>
            </Label>
            <Input
              id="presentacion-nombre"
              name="nombre"
              data-foco-inicial
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
                errores.nombre?.length ? "presentacion-nombre-error" : undefined
              }
            />
            {errores.nombre?.length ? (
              <p
                id="presentacion-nombre-error"
                className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
              >
                {errores.nombre.join(" ")}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="presentacion-uso">
              {t("uso")} <span className="text-error-500">*</span>
            </Label>
            <select
              id="presentacion-uso"
              name="uso"
              required
              value={uso}
              disabled={guardando}
              onChange={(evento) => {
                establecerUso(evento.target.value as UsoPresentacion);
                if (evento.target.value === "compra")
                  establecerColumnaPedido("otra");
                cambiarCampo(evento.currentTarget);
              }}
              className={claseSelector("uso")}
              aria-invalid={!!errores.uso?.length}
              aria-describedby="presentacion-uso-ayuda"
            >
              {["ambos", "compra", "pedido"].map((valor) => (
                <option key={valor} value={valor}>
                  {t(`usos.${valor}`)}
                </option>
              ))}
            </select>
            <p
              id="presentacion-uso-ayuda"
              className={`mt-1.5 text-theme-xs ${errores.uso?.length ? "text-error-500 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}
            >
              {errores.uso?.join(" ") || t("ayudaUso")}
            </p>
          </div>
        </div>
        <div className="px-6 pb-6">
          <Label htmlFor="columna_pedido">{t("columnaPedido")}</Label>
          <select
            id="columna_pedido"
            name="columna_pedido"
            value={columnaPedido}
            disabled={guardando || uso === "compra"}
            onChange={(evento) => {
              establecerColumnaPedido(
                evento.target.value as typeof columnaPedido,
              );
              cambiarCampo(evento.currentTarget);
            }}
            aria-invalid={!!errores.columna_pedido?.length}
            className={claseSelector("columna_pedido")}
          >
            {["otra", "cajas", "unidades"].map((valor) => (
              <option key={valor} value={valor}>
                {t(`columnas.${valor}`)}
              </option>
            ))}
          </select>
          <p
            className={`mt-1.5 text-xs ${errores.columna_pedido?.length ? "text-error-500" : "text-gray-500 dark:text-gray-400"}`}
          >
            {errores.columna_pedido?.join(" ") || t("columnaAyuda")}
          </p>
        </div>
        <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <Button
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={cerrar}
          >
            {t("cancelar")}
          </Button>
          <Button size="sm" type="submit" disabled={guardando || conflicto}>
            {t(
              guardando
                ? "guardando"
                : presentacion
                  ? "guardarCambios"
                  : "crear",
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
