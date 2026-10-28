"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { IconoSucursal, IconoUbicacion } from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { useFormValidation as useValidacion } from "@/hooks/useFormValidation";
import { focusInvalidField as enfocarInvalido } from "@/lib/form-validation";
import CampoDirectorio from "./CampoDirectorio";
import SelectorPedido from "@/components/pedidos/SelectorPedido";
import type { OpcionPedido } from "@/components/pedidos/tipos";
import type { Cliente, Sucursal } from "./tipos";

export default function FormularioSucursal({
  puedeAsignarEncargado = false,
  cliente,
  sucursal,
  alCerrar,
  alGuardar,
  alRecargar,
  alError,
}: {
  puedeAsignarEncargado?: boolean;
  cliente: Cliente;
  sucursal: Sucursal | null;
  alCerrar: () => void;
  alGuardar: () => void;
  alRecargar: () => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("clientes");
  const iniciales = {
    nombre: sucursal?.nombre || "",
    direccion: sucursal?.direccion || "",
    telefono: sucursal?.telefono || "",
    referencia: sucursal?.referencia || "",
    latitud: sucursal?.latitud || "",
    longitud: sucursal?.longitud || "",
  };
  const [datos, establecerDatos] = useState(iniciales);
  const [encargado, establecerEncargado] = useState<OpcionPedido | null>(
    sucursal?.encargado_pedidos || null,
  );
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const [ubicacionAbierta, establecerUbicacionAbierta] = useState(
    !!sucursal?.latitud,
  );
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacion();
  const modificado =
    encargado?.id !== sucursal?.encargado_pedidos?.id ||
    Object.keys(datos).some(
      (clave) =>
        datos[clave as keyof typeof datos] !==
        iniciales[clave as keyof typeof iniciales],
    );
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  const cerrar = () => {
    if (!guardando && (!modificado || window.confirm(t("descartar"))))
      alCerrar();
  };
  const cambiar = (entrada: HTMLInputElement) => {
    establecerDatos((actual) => ({ ...actual, [entrada.name]: entrada.value }));
    cambiarCampo(entrada);
  };
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (guardando || conflicto) return;
    const formulario = evento.currentTarget;
    const coordenadasIncompletas = !!datos.latitud !== !!datos.longitud;
    if (
      !validarFormulario(
        formulario,
        coordenadasIncompletas
          ? {
              latitud: [t("coordenadasCompletas")],
              longitud: [t("coordenadasCompletas")],
            }
          : {},
      )
    ) {
      if (coordenadasIncompletas) establecerUbicacionAbierta(true);
      alError(new ErrorApi(400));
      return;
    }
    establecerGuardando(true);
    establecerFallo("");
    try {
      await api(
        `clientes/${cliente.id}/sucursales/${sucursal ? `${sucursal.id}/` : ""}`,
        {
          method: sucursal ? "PATCH" : "POST",
          body: JSON.stringify({
            ...datos,
            ...(puedeAsignarEncargado
              ? { encargado_pedidos_id: encargado?.id || null }
              : {}),
            latitud: datos.latitud || null,
            longitud: datos.longitud || null,
            ...(sucursal ? { version: sucursal.version } : {}),
          }),
        },
      );
      alGuardar();
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        if (error.errors.latitud?.length || error.errors.longitud?.length)
          establecerUbicacionAbierta(true);
        enfocarInvalido(formulario);
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
  return (
    <Modal
      isOpen
      onClose={cerrar}
      className="max-w-2xl"
      labelledBy="titulo-sucursal"
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
            <IconoSucursal className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              id="titulo-sucursal"
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              {t(sucursal ? "editarSucursal" : "nuevaSucursal")}
            </h2>
            <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
              {cliente.razon_social}
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
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoDirectorio
              id="sucursal-nombre"
              etiqueta={t("nombreSucursal")}
              name="nombre"
              required
              data-foco-inicial
              maxLength={150}
              value={datos.nombre}
              disabled={guardando}
              errores={errores.nombre}
              placeholder={t("ejemploSucursal")}
              onChange={(evento) => cambiar(evento.currentTarget)}
              onBlur={(evento) => salirCampo(evento.currentTarget)}
            />
            <CampoDirectorio
              id="sucursal-telefono"
              etiqueta={t("telefono")}
              name="telefono"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={30}
              value={datos.telefono}
              disabled={guardando}
              errores={errores.telefono}
              ayuda={t("ayudaTelefono")}
              onChange={(evento) => cambiar(evento.currentTarget)}
              onBlur={(evento) => salirCampo(evento.currentTarget)}
            />
          </div>
          <CampoDirectorio
            id="sucursal-direccion"
            etiqueta={t("direccion")}
            name="direccion"
            required
            maxLength={255}
            value={datos.direccion}
            disabled={guardando}
            errores={errores.direccion}
            placeholder={t("ejemploDireccion")}
            onChange={(evento) => cambiar(evento.currentTarget)}
            onBlur={(evento) => salirCampo(evento.currentTarget)}
          />
          <CampoDirectorio
            id="sucursal-referencia"
            etiqueta={t("referencia")}
            name="referencia"
            maxLength={255}
            value={datos.referencia}
            disabled={guardando}
            errores={errores.referencia}
            ayuda={t("ayudaReferencia")}
            onChange={(evento) => cambiar(evento.currentTarget)}
            onBlur={(evento) => salirCampo(evento.currentTarget)}
          />
          {puedeAsignarEncargado && (
            <div className="space-y-2">
              <SelectorPedido
                ruta="clientes/encargados/"
                valor={encargado}
                alCambiar={establecerEncargado}
                etiqueta={t("encargadoPedidos")}
                deshabilitado={guardando}
                error={errores.encargado_pedidos_id?.join(" ")}
                alError={alError}
              />
              <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("encargadoAyuda")}
              </p>
            </div>
          )}
          <details
            open={ubicacionAbierta}
            onToggle={(evento) =>
              establecerUbicacionAbierta(evento.currentTarget.open)
            }
            className="rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <summary className="cursor-pointer rounded-xl p-4 text-sm font-medium text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-200">
              <span className="ms-1 inline-flex items-center gap-2">
                <IconoUbicacion className="size-4" />
                {t("ubicacionOpcional")}
              </span>
            </summary>
            <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-800">
              <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("ayudaUbicacion")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["latitud", "longitud"] as const).map((campo) => (
                  <CampoDirectorio
                    key={campo}
                    id={`sucursal-${campo}`}
                    etiqueta={t(campo)}
                    name={campo}
                    type="number"
                    inputMode="decimal"
                    step={0.0000001}
                    min={campo === "latitud" ? -90 : -180}
                    max={campo === "latitud" ? 90 : 180}
                    value={datos[campo]}
                    required={
                      !!datos[campo === "latitud" ? "longitud" : "latitud"]
                    }
                    disabled={guardando}
                    errores={errores[campo]}
                    onChange={(evento) => cambiar(evento.currentTarget)}
                    onBlur={(evento) => salirCampo(evento.currentTarget)}
                  />
                ))}
              </div>
            </div>
          </details>
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
                : sucursal
                  ? "guardarCambios"
                  : "crearSucursal",
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
