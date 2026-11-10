/** UUID v4 también para la prueba manual en una dirección HTTP de la red local. */
export function crearClaveOperacion(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const texto = Array.from(bytes, (valor) =>
    valor.toString(16).padStart(2, "0"),
  ).join("");
  return `${texto.slice(0, 8)}-${texto.slice(8, 12)}-${texto.slice(12, 16)}-${texto.slice(16, 20)}-${texto.slice(20)}`;
}
