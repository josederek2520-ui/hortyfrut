export class ErrorAplicacion extends Error {
  constructor(
    public readonly codigo: string,
    public readonly estado = 0,
    public readonly detalle?: string,
  ) {
    super(codigo);
  }
}
export function codigoError(error: unknown): string {
  return error instanceof ErrorAplicacion ? error.codigo : "conexion";
}
export function resultadoIncierto(error: unknown): boolean {
  return (
    error instanceof ErrorAplicacion &&
    (error.estado === 0 || error.estado >= 500) &&
    error.codigo !== "configuracion"
  );
}
