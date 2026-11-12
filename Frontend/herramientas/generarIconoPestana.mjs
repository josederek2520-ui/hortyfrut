import {
  readFile as leerArchivo,
  writeFile as escribirArchivo,
} from "node:fs/promises";
import convertirSvg from "sharp";

// Exportar el isotipo vectorial propio al contenedor ICO que sirve Next.
const origen = await leerArchivo(
  new URL("../src/icons/IsotipoHortyfru.svg", import.meta.url),
);
const tamanos = [16, 32, 48, 64, 128, 256];
const imagenes = await Promise.all(
  tamanos.map((tamano) =>
    convertirSvg(origen, { density: 384 })
      .resize(tamano, tamano)
      .png()
      .toBuffer(),
  ),
);
const cabecera = Buffer.alloc(6 + tamanos.length * 16);
cabecera.writeUInt16LE(1, 2);
cabecera.writeUInt16LE(tamanos.length, 4);
let desplazamiento = cabecera.length;
for (const [indice, tamano] of tamanos.entries()) {
  const posicion = 6 + indice * 16;
  cabecera[posicion] = tamano === 256 ? 0 : tamano;
  cabecera[posicion + 1] = tamano === 256 ? 0 : tamano;
  cabecera.writeUInt16LE(1, posicion + 4);
  cabecera.writeUInt16LE(32, posicion + 6);
  cabecera.writeUInt32LE(imagenes[indice].length, posicion + 8);
  cabecera.writeUInt32LE(desplazamiento, posicion + 12);
  desplazamiento += imagenes[indice].length;
}
const icono = Buffer.concat([cabecera, ...imagenes]);
for (const destino of [
  "../src/app/favicon.ico",
  "../public/images/favicon.ico",
]) {
  await escribirArchivo(new URL(destino, import.meta.url), icono);
}
process.stdout.write("Icono de HortyFru generado en seis tamaños.\n");
