import { useState } from "react";
import { View, Alert } from "react-native";
import { UserRound, LogOut, ShieldCheck, Sun, Moon } from "lucide-react-native";
import { usarSesion } from "./ProveedorSesion";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import {
  Pantalla,
  Tarjeta,
  Texto,
  Boton,
  Aviso,
} from "@/compartido/componentes/Elementos";
import { codigoError } from "@/compartido/dominio/Errores";
import { BarraNavegacionChofer } from "@/compartido/componentes/BarraNavegacionChofer";
import type { ClaveMensaje } from "@/compartido/traducciones/mensajes";

export default function PantallaCuenta() {
  const { sesion, servicio } = usarSesion(),
    { colores, idioma, cambiarIdioma, tema, cambiarTema, t } = usarInterfaz();
  const [guardandoTema, establecerGuardandoTema] = useState(false);
  const [ocupado, establecerOcupado] = useState(false),
    [error, establecerError] = useState("");
  const salir = async () => {
    if (ocupado) return;
    establecerOcupado(true);
    try {
      await servicio.cerrar();
    } catch (problema) {
      establecerError(t(`error_${codigoError(problema)}` as ClaveMensaje));
    } finally {
      establecerOcupado(false);
    }
  };
  return (
    <Pantalla
      titulo={t("cuenta")}
      volver
      pie={<BarraNavegacionChofer actual="cuenta" />}
    >
      <Tarjeta>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              padding: 16,
              backgroundColor: colores.verdeSuave,
              borderRadius: 20,
            }}
          >
            <UserRound size={28} color={colores.verdeTexto} />
          </View>
          <View style={{ flex: 1 }}>
            <Texto tipo="subtitulo">{sesion?.usuario.nombre}</Texto>
            <Texto tipo="pequeno" color={colores.secundario}>
              HortyFru · {t("sesion")}
            </Texto>
          </View>
        </View>
      </Tarjeta>
      <Tarjeta>
        <Texto tipo="subtitulo">{t("apariencia")}</Texto>
        <Texto tipo="pequeno" color={colores.secundario}>
          {t("aparienciaAyuda")}
        </Texto>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {(["claro", "oscuro"] as const).map((valor) => {
            const Icono = valor === "claro" ? Sun : Moon;
            return (
              <View key={valor} style={{ flex: 1, minWidth: 110 }}>
                <Boton
                  titulo={t(valor === "claro" ? "temaClaro" : "temaOscuro")}
                  secundario={tema !== valor}
                  deshabilitado={guardandoTema}
                  icono={
                    <Icono
                      size={18}
                      color={
                        tema === valor ? colores.blanco : colores.verdeTexto
                      }
                    />
                  }
                  alPulsar={() => {
                    establecerError("");
                    establecerGuardandoTema(true);
                    void cambiarTema(valor)
                      .catch(() => establecerError(t("errorGuardarTema")))
                      .finally(() => establecerGuardandoTema(false));
                  }}
                />
              </View>
            );
          })}
        </View>
      </Tarjeta>
      <Tarjeta>
        <Texto tipo="subtitulo">{t("idioma")}</Texto>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Boton
              titulo={t("espanol")}
              alPulsar={() => cambiarIdioma("es")}
              secundario={idioma !== "es"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Boton
              titulo={t("ingles")}
              alPulsar={() => cambiarIdioma("en")}
              secundario={idioma !== "en"}
            />
          </View>
        </View>
      </Tarjeta>
      <Tarjeta>
        <ShieldCheck color={colores.verdeTexto} />
        <Texto color={colores.secundario}>{t("accesoSeguro")}</Texto>
        <Boton
          titulo={t("cerrarSesion")}
          ocupado={ocupado}
          alPulsar={() =>
            Alert.alert(t("confirmarCerrar"), t("cerrarAyuda"), [
              { text: t("cancelar"), style: "cancel" },
              { text: t("cerrarSesion"), onPress: () => void salir() },
            ])
          }
          secundario
          icono={<LogOut size={20} color={colores.verdeTexto} />}
        />
      </Tarjeta>
      {error ? <Aviso error>{error}</Aviso> : null}
    </Pantalla>
  );
}
