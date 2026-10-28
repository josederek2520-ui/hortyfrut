"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import Label from "@/components/form/Label";
import SelectorCompra from "@/components/compras/SelectorCompra";
import { clasePanel } from "@/components/compras/tipos";
import { useModal } from "@/hooks/useModal";
import { useFormValidation } from "@/hooks/useFormValidation";
import type { FieldErrors as ErroresCampos } from "@/lib/form-validation";
import ResumenCajillas from "./ResumenCajillas";
import ColorCajilla from "./ColorCajilla";
import ConfirmarSalidaCajillas from "./ConfirmarSalidaCajillas";
import type {
  Cajilla,
  MovimientoCajilla,
  TipoMovimientoCajilla,
  UbicacionCajillas,
} from "./tipos";

export default function FormularioMovimientoCajilla({
  cajilla,
  tipo,
  sucursalInicial,
  alError,
}: {
  cajilla: Cajilla;
  tipo: TipoMovimientoCajilla;
  sucursalInicial?: UbicacionCajillas;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("cajillas");
  const idioma = useLocale();
  const navegador = useRouter();
  const identificador = useId();
  const modal = useModal();
  const modalSalida = useModal();
  const [actual, establecerActual] = useState(cajilla);
  const [almacen, establecerAlmacen] = useState<UbicacionCajillas | null>(null);
  const [sucursal, establecerSucursal] = useState<UbicacionCajillas | null>(
    sucursalInicial || null,
  );
  const [cantidad, establecerCantidad] = useState("");
  const [observaciones, establecerObservaciones] = useState("");
  const [claveOperacion] = useState(() => crypto.randomUUID());
  const [ocupado, establecerOcupado] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validar,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useFormValidation();
  const limite =
    tipo === "salida"
      ? almacen?.cantidad
      : tipo === "devolucion"
        ? sucursal?.pendiente
        : undefined;
  const modificado =
    !!cantidad ||
    !!observaciones ||
    !!almacen ||
    sucursal?.id !== sucursalInicial?.id;
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  const revisar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (ocupado || conflicto) return;
    const problemas: ErroresCampos = {};
    if (!almacen) problemas.almacen = [t("seleccionarAlmacen")];
    if (tipo !== "ingreso" && !sucursal)
      problemas.sucursal = [t("seleccionarSucursal")];
    if (
      !/^\d{1,10}$/.test(cantidad) ||
      Number(cantidad) < 1 ||
      Number(cantidad) > 2147483647
    )
      problemas.cantidad = [t("cantidadPositiva")];
    else if (
      limite !== undefined &&
      limite !== null &&
      Number(cantidad) > limite
    )
      problemas.cantidad = [t("superaSaldo", { cantidad: limite })];
    if (validar(evento.currentTarget, problemas)) modal.openModal();
  };
  const registrar = async () => {
    if (ocupado || conflicto) return;
    establecerOcupado(true);
    establecerFallo("");
    try {
      await api<{ cajilla: Cajilla; movimiento: MovimientoCajilla }>(
        `cajillas/${actual.id}/movimientos/`,
        {
          method: "POST",
          body: JSON.stringify({
            tipo,
            cantidad: Number(cantidad),
            almacen: almacen!.id,
            sucursal: tipo === "ingreso" ? null : sucursal!.id,
            observaciones: observaciones.trim(),
            version: actual.version,
            clave_operacion: claveOperacion,
          }),
        },
      );
      sessionStorage.setItem("cajillas:aviso", "movimientoGuardado");
      navegador.replace(`/cajillas/${actual.id}`);
      navegador.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        establecerErrores(error.errors);
        establecerConflicto(error.status === 409);
      }
      establecerFallo(
        t(
          error instanceof ApiError && error.status === 409
            ? "conflicto"
            : "errorGuardar",
        ),
      );
      modal.closeModal();
      alError(error);
    } finally {
      establecerOcupado(false);
    }
  };
  const recargar = async () => {
    if (ocupado) return;
    establecerOcupado(true);
    try {
      establecerActual(await api<Cajilla>(`cajillas/${actual.id}/`));
      establecerAlmacen(null);
      establecerSucursal(null);
      establecerErrores({});
      establecerFallo("");
      establecerConflicto(false);
    } catch (error) {
      alError(error);
    } finally {
      establecerOcupado(false);
    }
  };
  const numero = (valor: number) => new Intl.NumberFormat(idioma).format(valor);
  return (
    <form noValidate onSubmit={revisar} className="space-y-6">
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <ColorCajilla color={actual.color} />
        <h1 className="mt-5 text-xl font-semibold text-gray-900 dark:text-white">
          {t(`titulos.${tipo}`)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(`ayudas.${tipo}`)}
        </p>
      </section>
      <ResumenCajillas resumen={actual} />
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("datosMovimiento")}
        </h2>
        <fieldset
          disabled={ocupado}
          className="mt-5 grid items-start gap-5 sm:grid-cols-2"
        >
          <legend className="sr-only">{t("datosMovimiento")}</legend>
          <SelectorCompra<UbicacionCajillas>
            ruta={
              tipo === "salida"
                ? `cajillas/${actual.id}/saldos-almacenes/?operacion=salida`
                : "cajillas/almacenes/"
            }
            etiqueta={t(tipo === "salida" ? "almacenOrigen" : "almacenDestino")}
            valor={almacen}
            nombre="almacen"
            deshabilitado={ocupado}
            error={errores.almacen?.join(" ")}
            alError={alError}
            descripcion={(opcion) =>
              tipo === "salida"
                ? t("saldoDisponible", {
                    cantidad: numero(opcion.cantidad || 0),
                  })
                : null
            }
            alElegir={(valor) => {
              establecerAlmacen(valor);
              establecerErrores((actuales) => ({
                ...actuales,
                almacen: [],
                cantidad: [],
              }));
            }}
          />
          {tipo !== "ingreso" && (
            <SelectorCompra<UbicacionCajillas>
              ruta={`cajillas/sucursales/?operacion=${tipo}&cajilla=${actual.id}`}
              etiqueta={t(
                tipo === "salida" ? "sucursalDestino" : "sucursalOrigen",
              )}
              valor={sucursal}
              nombre="sucursal"
              deshabilitado={ocupado}
              error={errores.sucursal?.join(" ")}
              alError={alError}
              descripcion={(opcion) =>
                tipo === "devolucion"
                  ? t("pendienteDevolver", {
                      cantidad: numero(opcion.pendiente || 0),
                    })
                  : null
              }
              alElegir={(valor) => {
                establecerSucursal(valor);
                establecerErrores((actuales) => ({
                  ...actuales,
                  sucursal: [],
                  cantidad: [],
                }));
              }}
            />
          )}
          <CampoDirectorio
            id="cantidad"
            name="cantidad"
            etiqueta={t("cantidad")}
            type="number"
            inputMode="numeric"
            min={1}
            max={limite ?? 2147483647}
            step={1}
            required
            value={cantidad}
            errores={errores.cantidad}
            ayuda={
              limite !== undefined && limite !== null
                ? t(
                    tipo === "salida" ? "saldoDisponible" : "pendienteDevolver",
                    { cantidad: numero(limite) },
                  )
                : t("cantidadAyuda")
            }
            onChange={(evento) => {
              establecerCantidad(evento.target.value);
              cambiarCampo(evento.target);
            }}
            onBlur={(evento) => salirCampo(evento.target)}
          />
          <div className="sm:col-span-2">
            <Label htmlFor="observaciones-cajillas">{t("observaciones")}</Label>
            <textarea
              id="observaciones-cajillas"
              name="observaciones"
              rows={3}
              maxLength={500}
              value={observaciones}
              aria-invalid={!!errores.observaciones?.length}
              aria-describedby="observaciones-cajillas-error"
              onChange={(evento) => {
                establecerObservaciones(evento.target.value);
                cambiarCampo(evento.target);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-800 focus-visible:ring-3 focus-visible:ring-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <p
              id="observaciones-cajillas-error"
              className="mt-1 text-theme-xs text-error-500 dark:text-error-400"
            >
              {errores.observaciones?.join(" ")}
            </p>
          </div>
        </fieldset>
        <p className="mt-5 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("fechaAutomatica")}
        </p>
      </section>
      {fallo && (
        <div
          role="alert"
          className="space-y-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
        >
          <p>{fallo}</p>
          {conflicto && (
            <>
              <p>{t("recargarAyuda")}</p>
              <Button variant="outline" disabled={ocupado} onClick={recargar}>
                {t("recargarSaldos")}
              </Button>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => {
            if (modificado) modalSalida.openModal();
            else navegador.push(`/cajillas/${actual.id}`);
          }}
        >
          {t("volver")}
        </Button>
        <Button type="submit" disabled={ocupado || conflicto}>
          {t("revisarMovimiento")}
        </Button>
      </div>
      <Modal
        isOpen={modal.isOpen}
        onClose={() => {
          if (!ocupado) modal.closeModal();
        }}
        className="max-w-lg"
        labelledBy={identificador}
        closeLabel={t("cerrar")}
      >
        <div className="space-y-5 p-6 sm:p-8">
          <h2
            id={identificador}
            className="pe-8 text-xl font-semibold text-gray-900 dark:text-white"
          >
            {t("confirmarMovimiento")}
          </h2>
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t("confirmarAyuda")}
          </p>
          <dl className="space-y-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
            {[
              ["tipoMovimiento", t(`tipos.${tipo}`)],
              ["color", actual.color],
              ["cantidad", numero(Number(cantidad))],
              [
                tipo === "salida" ? "almacenOrigen" : "almacenDestino",
                almacen?.nombre || "—",
              ],
              ...(tipo !== "ingreso"
                ? [
                    [
                      tipo === "salida" ? "sucursalDestino" : "sucursalOrigen",
                      sucursal?.nombre || "—",
                    ],
                  ]
                : []),
            ].map(([clave, valor]) => (
              <div
                key={clave}
                className="flex items-start justify-between gap-5"
              >
                <dt className="text-gray-500 dark:text-gray-400">{t(clave)}</dt>
                <dd className="max-w-xs text-end font-medium break-words text-gray-900 dark:text-white">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
          {observaciones.trim() && (
            <p className="text-sm whitespace-pre-wrap text-gray-600 dark:text-gray-300">
              {observaciones.trim()}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              disabled={ocupado}
              onClick={modal.closeModal}
            >
              {t("volver")}
            </Button>
            <Button disabled={ocupado} onClick={registrar}>
              {t(ocupado ? "guardando" : "confirmarRegistro")}
            </Button>
          </div>
        </div>
      </Modal>
      {modalSalida.isOpen && (
        <ConfirmarSalidaCajillas
          alCerrar={modalSalida.closeModal}
          alSalir={() => navegador.push(`/cajillas/${actual.id}`)}
        />
      )}
    </form>
  );
}
