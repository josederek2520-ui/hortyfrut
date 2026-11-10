import { createRequire as crearRequire } from "node:module";
import { crearPasarela } from "../infraestructura/chofer_https/pasarela_chofer.mjs";
const require = crearRequire(import.meta.url);
const WebSocket = require("../Frontend/node_modules/next/dist/compiled/ws");
let entrada = "";
for await (const parte of process.stdin) entrada += parte;
const datos = JSON.parse(entrada);
const origen = "https://chat-prueba.trycloudflare.com";
const pasarela = crearPasarela({
  obtenerEstado: () => ({ estado: "listo", origen }),
  claveControl: "x".repeat(64),
  alDetener: () => {},
  puertos: { api: 1, web: 1 },
  puertoChat: datos.puerto,
});
await new Promise((resolver) => pasarela.listen(0, "127.0.0.1", resolver));
const canal = new WebSocket(
  `ws://127.0.0.1:${pasarela.address().port}/ws/chat/`,
  {
    origin: origen,
    headers: {
      host: "chat-prueba.trycloudflare.com",
      "x-forwarded-proto": "https",
    },
  },
);
let recibido = false;
const limite = setTimeout(() => {
  process.exitCode = 1;
  canal.terminate();
  pasarela.close();
}, 15000);
canal.on("open", () =>
  canal.send(JSON.stringify({ tipo: "autorizar", acceso: datos.acceso })),
);
canal.on("message", (cuerpo) => {
  const mensaje = JSON.parse(String(cuerpo));
  if (mensaje.inicial) process.stdout.write("LISTO\n");
  else if (mensaje.datos.no_leidos === 1) {
    recibido = true;
    process.stdout.write(JSON.stringify(mensaje.datos) + "\n");
    canal.close();
  }
});
canal.on("error", () => {
  process.exitCode = 1;
});
canal.on("close", () => {
  clearTimeout(limite);
  if (!recibido) process.exitCode = 1;
  pasarela.close();
});
