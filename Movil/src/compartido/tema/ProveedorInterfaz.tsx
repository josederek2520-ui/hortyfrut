import { createContext, useContext, useState, useEffect, useRef } from "react";
import { AccessibilityInfo, Appearance, Platform } from "react-native";
import * as SystemUI from "expo-system-ui";
import {
  mensajes,
  type ClaveMensaje,
} from "@/compartido/traducciones/mensajes";
import { almacen } from "@/composicion/dependencias";

const claro = {
  fondo: "#F5F7F6",
  tarjeta: "#FFFFFF",
  texto: "#17251D",
  secundario: "#59675F",
  borde: "#E2E8E4",
  verde: "#147C40",
  verdeSuave: "#EAF5EE",
  verdeTexto: "#16683B",
  naranja: "#FFF0E3",
  naranjaTexto: "#9D4219",
  error: "#B3261E",
  errorFondo: "#FFF0EE",
  blanco: "#FFFFFF",
  pendienteFondo: "#EAF2FF",
  pendienteTexto: "#245B9A",
  neutroFondo: "#EFF2F0",
  sombra: "#10291D",
};
const oscuro: typeof claro = {
  fondo: "#111613",
  tarjeta: "#1C231F",
  texto: "#F0F6F2",
  secundario: "#B0BDB5",
  borde: "#344039",
  verde: "#63D48C",
  verdeSuave: "#21372A",
  verdeTexto: "#A5E9BB",
  naranja: "#3F2D20",
  naranjaTexto: "#FFC89E",
  error: "#FFB4AB",
  errorFondo: "#3E2522",
  blanco: "#102017",
  pendienteFondo: "#203149",
  pendienteTexto: "#B6D3FF",
  neutroFondo: "#28312C",
  sombra: "#000000",
};
interface Interfaz {
  colores: typeof claro;
  oscuro: boolean;
  tema: "claro" | "oscuro";
  cambiarTema: (tema: "claro" | "oscuro") => Promise<void>;
  reducirMovimiento: boolean;
  idioma: "es" | "en";
  cambiarIdioma: (idioma: "es" | "en") => void;
  t: (clave: ClaveMensaje, valores?: Record<string, string | number>) => string;
}
const Contexto = createContext<Interfaz | null>(null);
export function ProveedorInterfaz({ children }: { children: React.ReactNode }) {
  const [tema, establecerTema] = useState<"claro" | "oscuro">("claro");
  const revisionTema = useRef(0);
  const escrituraTema = useRef(Promise.resolve());
  const esOscuro = tema === "oscuro";
  const [idioma, establecerIdioma] = useState<"es" | "en">("es");
  const [reducirMovimiento, establecerReducir] = useState(true);
  useEffect(() => {
    let vigente = true;
    const revisionInicial = revisionTema.current;
    void almacen
      .leer("hortyfru.tema")
      .then((valor) => {
        if (
          vigente &&
          revisionTema.current === revisionInicial &&
          (valor === "claro" || valor === "oscuro")
        )
          establecerTema(valor);
      })
      .catch(() => {});
    void AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (vigente) establecerReducir(valor);
    });
    const escucha = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      establecerReducir,
    );
    void almacen.leer("hortyfru.idioma").then((valor) => {
      if (vigente && (valor === "es" || valor === "en"))
        establecerIdioma(valor);
    });
    return () => {
      vigente = false;
      escucha.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "web") {
      Appearance.setColorScheme(esOscuro ? "dark" : "light");
      void SystemUI.setBackgroundColorAsync(
        esOscuro ? oscuro.fondo : claro.fondo,
      ).catch(() => {});
    }
  }, [esOscuro]);
  const cambiarTema = (valor: "claro" | "oscuro") => {
    ++revisionTema.current;
    establecerTema(valor);
    const guardado = escrituraTema.current
      .catch(() => {})
      .then(() => almacen.guardar("hortyfru.tema", valor));
    escrituraTema.current = guardado;
    return guardado;
  };
  const cambiarIdioma = (valor: "es" | "en") => {
    establecerIdioma(valor);
    void almacen.guardar("hortyfru.idioma", valor).catch(() => {});
  };
  const t: Interfaz["t"] = (clave, valores = {}) =>
    Object.entries(valores).reduce<string>(
      (texto, [campo, valor]) => texto.replaceAll(`{${campo}}`, String(valor)),
      mensajes[idioma][clave],
    );
  return (
    <Contexto.Provider
      value={{
        colores: esOscuro ? oscuro : claro,
        oscuro: esOscuro,
        tema,
        cambiarTema,
        reducirMovimiento,
        idioma,
        cambiarIdioma,
        t,
      }}
    >
      {children}
    </Contexto.Provider>
  );
}
export function usarInterfaz() {
  const interfaz = useContext(Contexto);
  if (!interfaz) throw Error("Falta ProveedorInterfaz");
  return interfaz;
}
