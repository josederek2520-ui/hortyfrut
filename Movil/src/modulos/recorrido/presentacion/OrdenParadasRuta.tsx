import { useState } from "react";
import { Pressable, View } from "react-native";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { Paginador, Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { moverParada, paradasRuta } from "../aplicacion/ordenRuta";
import { colorPuntoRuta } from "../aplicacion/coloresRuta";
import type { RutaViaje } from "../dominio/Ruta";

export default function OrdenParadasRuta({
  ruta,
  ocupado,
  alCambiar,
}: {
  ruta: RutaViaje;
  ocupado: boolean;
  alCambiar: (orden: number[]) => void;
}) {
  const { colores, t } = usarInterfaz();
  const [pagina, establecerPagina] = useState(1);
  const paradas = paradasRuta(ruta),
    orden = paradas.map((punto) => punto.parada!);
  const paginaValida = Math.min(
    pagina,
    Math.max(1, Math.ceil(paradas.length / 10)),
  );
  const mover = (indice: number, cambio: -1 | 1) => {
    alCambiar(moverParada(orden, indice, cambio));
    establecerPagina(Math.floor((indice + cambio) / 10) + 1);
  };
  return (
    <View style={{ gap: 4 }}>
      {paradas
        .slice((paginaValida - 1) * 10, paginaValida * 10)
        .map((punto, posicion) => {
          const indice = (paginaValida - 1) * 10 + posicion;
          return (
            <View
              key={punto.parada}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: colores.borde,
                paddingVertical: 4,
              }}
            >
              <Texto
                color={colores.blanco}
                style={{
                  minWidth: 27,
                  fontWeight: "700",
                  textAlign: "center",
                  borderRadius: 8,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  backgroundColor: colorPuntoRuta(punto),
                }}
              >
                {indice + 1}
              </Texto>
              <View style={{ flex: 1 }}>
                <Texto style={{ fontWeight: "600" }}>{punto.nombre}</Texto>
                {!!punto.cliente && (
                  <Texto tipo="pequeno" color={colores.secundario}>
                    {punto.cliente}
                  </Texto>
                )}
              </View>
              {([-1, 1] as const).map((cambio) => {
                const deshabilitado =
                  ocupado ||
                  (cambio === -1
                    ? indice === 0
                    : indice === paradas.length - 1);
                const Icono = cambio === -1 ? ArrowUp : ArrowDown;
                return (
                  <Pressable
                    key={cambio}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: deshabilitado }}
                    accessibilityLabel={t(
                      cambio === -1 ? "subirDestinoRuta" : "bajarDestinoRuta",
                      { nombre: punto.nombre },
                    )}
                    disabled={deshabilitado}
                    onPress={() => mover(indice, cambio)}
                    style={{
                      width: 48,
                      height: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: deshabilitado ? 0.25 : 1,
                    }}
                  >
                    <Icono size={20} color={colores.texto} />
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      <Paginador
        pagina={paginaValida}
        total={paradas.length}
        alCambiar={establecerPagina}
        ocupado={ocupado}
      />
    </View>
  );
}
