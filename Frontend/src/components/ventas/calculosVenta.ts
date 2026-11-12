import type { EntregaVenta, FormularioVenta, Venta } from "./tipos";

export function hoyBolivia() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((tipo) => partes.find((parte) => parte.type === tipo)!.value)
    .join("-");
}
export function formularioDesdeVenta(venta: Venta): FormularioVenta {
  return {
    cliente: {
      id: venta.cliente,
      nombre: venta.cliente_nombre,
      nit: venta.cliente_nit,
    },
    desde: venta.desde,
    hasta: venta.hasta,
    vencimiento: venta.vencimiento ?? "",
    entregas: venta.entregas,
  };
}
export function sumarImportes(entregas: EntregaVenta[]): string | null {
  if (!entregas.length || entregas.some((fila) => fila.total === null))
    return null;
  const centavos = entregas.reduce((suma, fila) => {
    const [enteros, decimales = ""] = fila.total!.split(".");
    return (
      suma + BigInt(enteros) * BigInt(100) + BigInt(decimales.padEnd(2, "0"))
    );
  }, BigInt(0));
  return `${centavos / BigInt(100)}.${String(centavos % BigInt(100)).padStart(2, "0")}`;
}
export function alternarEntrega(
  entregas: EntregaVenta[],
  fila: EntregaVenta,
): EntregaVenta[] {
  if (entregas.some((actual) => actual.id === fila.id))
    return entregas.filter((actual) => actual.id !== fila.id);
  if (fila.incidencias.length || entregas.length >= 100) return entregas;
  return [...entregas, fila];
}
export function validarVenta(
  formulario: FormularioVenta,
  revisar = false,
): string[] {
  const errores: string[] = [];
  if (!formulario.cliente) errores.push("clienteRequerido");
  if (
    !formulario.desde ||
    !formulario.hasta ||
    formulario.hasta < formulario.desde
  )
    errores.push("periodoInvalido");
  if (revisar && !formulario.entregas.length)
    errores.push("seleccionRequerida");
  if (formulario.entregas.length > 100) errores.push("limiteEntregas");
  if (
    formulario.entregas.some(
      (fila) =>
        fila.fecha_recepcion < formulario.desde ||
        fila.fecha_recepcion > formulario.hasta,
    )
  )
    errores.push("fueraPeriodo");
  return errores;
}
export function mostrarFechaVenta(fecha: string | null, idioma: string) {
  return fecha
    ? new Date(fecha.slice(0, 10) + "T12:00:00").toLocaleDateString(idioma)
    : "—";
}
export function mostrarPesoVenta(peso: string) {
  return peso.includes(".") ? peso.replace(/0+$/, "").replace(/\.$/, "") : peso;
}
