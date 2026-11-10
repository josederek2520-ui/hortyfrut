import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import {
  copyFileSync as copiarArchivo,
  mkdirSync as crearCarpeta,
  readFileSync as leerArchivo,
} from "node:fs";
import { join as unir } from "node:path";
import { execFileSync as ejecutarProceso } from "node:child_process";

// Se aplica también cuando los lanzadores invocan Next directamente, sin npm.
ejecutarProceso(
  process.execPath,
  [unir(__dirname, "herramientas", "validarTraducciones.mjs")],
  { encoding: "utf8", stdio: "pipe", windowsHide: true, timeout: 5000 },
);

// Turbopack agrupa el motor, pero su worker ESM debe servirse como archivo propio.
// Copiar la misma version instalada evita rutas inferidas desde los chunks de Next.
const carpetaMotor = unir(__dirname, "node_modules", "maplibre-gl");
const versionMotor: string = JSON.parse(
  leerArchivo(unir(carpetaMotor, "package.json"), "utf8"),
).version;
const carpetaWorker = unir(
  __dirname,
  "public",
  "mapas",
  "maplibre",
  versionMotor,
);
crearCarpeta(carpetaWorker, { recursive: true });
copiarArchivo(
  unir(carpetaMotor, "dist", "maplibre-gl-worker.mjs"),
  unir(carpetaWorker, "worker.mjs"),
);
copiarArchivo(
  unir(carpetaMotor, "LICENSE.txt"),
  unir(carpetaWorker, "LICENSE.txt"),
);

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // El acceso HTTPS del chofer tiene una compilación y un proceso independientes.
  distDir: process.env.MODO_CHOFER_HTTPS === "1" ? ".next-chofer" : ".next",
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      ...(process.env.MODO_CHOFER_HTTPS === "1"
        ? []
        : [
            {
              source: "/ws/:path*",
              destination: "http://127.0.0.1:8002/ws/:path*",
            },
          ]),
      {
        source: "/api/:path*",
        destination: `${process.env.DJANGO_API_URL || "http://127.0.0.1:8000"}/api/:path*/`,
      },
    ];
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  images: {
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default withNextIntl(nextConfig);
