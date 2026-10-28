"use client";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { TimeIcon as IconoHistorial, LockIcon as IconoCandado } from "@/icons";
import type { DetalleActividad as DatosActividad } from "./tipos";

export default function DetalleActividad({
  registro,
  alCerrar,
}: {
  registro: DatosActividad;
  alCerrar: () => void;
}) {
  const t = useTranslations("actividad");
  const permisos = useTranslations("roles.permissionLabels");
  const textosPresentacion = useTranslations("presentaciones");
  const textosPedidos = useTranslations("pedidos");
  const idioma = useLocale();
  const mostrar = (valor: unknown, campo?: string): string => {
    if (valor === null || valor === undefined) return t("sinValor");
    if (typeof valor === "boolean") return t(valor ? "si" : "no");
    if (valor === "[dato protegido]") return t("datoProtegido");
    if (Array.isArray(valor))
      return valor.length
        ? valor.map((elemento) => mostrar(elemento, campo)).join("\n")
        : t("sinValor");
    if (typeof valor === "object")
      return Object.entries(valor)
        .map(
          ([clave, contenido]) =>
            `${t.has(`campos.${clave}`) ? t(`campos.${clave}`) : clave}: ${mostrar(contenido, clave)}`,
        )
        .join("\n");
    if (
      campo === "columna_pedido" &&
      typeof valor === "string" &&
      textosPresentacion.has(`columnas.${valor}`)
    )
      return textosPresentacion(`columnas.${valor}`);
    if (registro.modulo === "pedidos" && typeof valor === "string") {
      if (campo === "columna" && (valor === "cajas" || valor === "unidades"))
        return textosPedidos(valor);
      if (campo === "estado" && textosPedidos.has(`estados.${valor}`))
        return textosPedidos(`estados.${valor}`);
    }
    if (
      registro.modulo === "presentaciones" &&
      campo === "uso" &&
      typeof valor === "string" &&
      textosPresentacion.has(`usos.${valor}`)
    ) {
      return textosPresentacion(`usos.${valor}`);
    }
    const codigo = String(valor).split(".")[1];
    if (codigo && permisos.has(codigo)) return permisos(codigo);
    if (typeof valor === "string" && t.has(`campos.${valor}`))
      return t(`campos.${valor}`);
    return String(valor);
  };
  const campos = Object.entries(registro.cambios);
  return (
    <Modal
      isOpen
      onClose={alCerrar}
      className="max-w-3xl"
      labelledBy="titulo-evento"
      closeLabel={t("cerrar")}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="shrink-0 border-b border-gray-100 p-6 pe-16 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
              <IconoHistorial className="size-5" />
            </span>
            <div>
              <h2
                id="titulo-evento"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                {t("eventoNumero", { id: registro.id })}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t.has(`acciones.${registro.accion}`)
                  ? t(`acciones.${registro.accion}`)
                  : registro.accion.replaceAll("_", " ")}
              </p>
            </div>
          </div>
        </div>
        <div className="custom-scrollbar space-y-6 overflow-y-auto p-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            {[
              [t("responsable"), registro.responsable],
              [
                t("fecha"),
                new Intl.DateTimeFormat(idioma, {
                  dateStyle: "long",
                  timeStyle: "medium",
                  timeZone: "America/La_Paz",
                }).format(new Date(registro.fecha)),
              ],
              [
                t("modulo"),
                t.has(`modulos.${registro.modulo}`)
                  ? t(`modulos.${registro.modulo}`)
                  : registro.modulo,
              ],
              [t("resultado"), t(`resultados.${registro.resultado}`)],
              [
                t("registro"),
                registro.objeto_nombre ||
                  registro.objeto_tipo ||
                  t("sinObjeto"),
              ],
              [t("identificador"), registro.objeto_id || t("sinValor")],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta}>
                <dt className="mb-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {etiqueta}
                </dt>
                <dd className="text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              {t("cambios")}
            </h3>
            {!campos.length ? (
              <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                {t("sinCambios")}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-start text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {["campo", "antes", "despues"].map((clave) => (
                        <th
                          key={clave}
                          scope="col"
                          className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                        >
                          {t(clave)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campos.map(([campo, valores]) => {
                      const par =
                        valores &&
                        typeof valores === "object" &&
                        !Array.isArray(valores) &&
                        "antes" in valores &&
                        "despues" in valores
                          ? (valores as { antes: unknown; despues: unknown })
                          : null;
                      return (
                        <tr
                          key={campo}
                          className="border-t border-gray-100 dark:border-gray-700"
                        >
                          <th
                            scope="row"
                            className="px-4 py-3 text-start text-theme-xs font-medium text-gray-600 dark:text-gray-300"
                          >
                            {t.has(`campos.${campo}`)
                              ? t(`campos.${campo}`)
                              : campo.replaceAll("_", " ")}
                          </th>
                          <td className="max-w-xs px-4 py-3 text-theme-xs break-words whitespace-pre-wrap text-gray-500 dark:text-gray-400">
                            {par
                              ? mostrar(par.antes, campo)
                              : valores === "[dato protegido]"
                                ? t("datoProtegido")
                                : t("sinEstadoAnterior")}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-theme-xs break-words whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                            {mostrar(par ? par.despues : valores, campo)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className="rounded-xl bg-gray-50 p-4 text-theme-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
            <p className="flex items-center gap-2 font-medium">
              <IconoCandado className="size-3.5" />
              {t("soloLectura")}
            </p>
            <p className="mt-2 leading-5">{t("datosProtegidos")}</p>
            {registro.origen === "historico" && (
              <p className="mt-2 leading-5">{t("historialImportado")}</p>
            )}
            <dl className="mt-4 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              <div>
                <dt className="inline font-medium">{t("solicitud")}: </dt>
                <dd className="font-mono inline break-all">
                  {registro.solicitud_id}
                </dd>
              </div>
              {registro.metodo && (
                <div>
                  <dt className="inline font-medium">{t("operacion")}: </dt>
                  <dd className="font-mono inline break-all">
                    {registro.metodo} {registro.ruta}
                  </dd>
                </div>
              )}
              {registro.codigo_http && (
                <div>
                  <dt className="inline font-medium">HTTP: </dt>
                  <dd className="inline">{registro.codigo_http}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        <div className="flex shrink-0 justify-end border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <Button size="sm" variant="outline" onClick={alCerrar}>
            {t("cerrar")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
