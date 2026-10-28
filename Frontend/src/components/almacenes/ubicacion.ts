export function enlaceMapa(
  latitud: string | null,
  longitud: string | null,
): string | null {
  if (
    latitud === null ||
    longitud === null ||
    !latitud.trim() ||
    !longitud.trim()
  )
    return null;
  const valorLatitud = Number(latitud),
    valorLongitud = Number(longitud);
  if (
    !Number.isFinite(valorLatitud) ||
    !Number.isFinite(valorLongitud) ||
    valorLatitud < -90 ||
    valorLatitud > 90 ||
    valorLongitud < -180 ||
    valorLongitud > 180
  )
    return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${valorLatitud},${valorLongitud}`)}`;
}
