import { useState, useRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  type TextInputInstance,
} from "react-native";
import { Redirect } from "expo-router";
import { Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react-native";
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
import type { ClaveMensaje } from "@/compartido/traducciones/mensajes";

export default function PantallaAcceso() {
  const { fase, servicio } = usarSesion(),
    { colores, t } = usarInterfaz();
  const [correo, establecerCorreo] = useState("");
  const [contrasena, establecerContrasena] = useState("");
  const [visible, establecerVisible] = useState(false);
  const [ocupado, establecerOcupado] = useState(false);
  const [error, establecerError] = useState("");
  const candado = useRef(false),
    campoContrasena = useRef<TextInputInstance>(null);
  if (fase === "autenticada") return <Redirect href="/(chofer)/viajes" />;
  const ingresar = async () => {
    if (candado.current) return;
    if (!correo.trim() || !contrasena) {
      establecerError(t("requerido"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      establecerError(t("correoInvalido"));
      return;
    }
    candado.current = true;
    establecerOcupado(true);
    establecerError("");
    try {
      await servicio.ingresar(correo, contrasena);
    } catch (problema) {
      establecerError(t(`error_${codigoError(problema)}` as ClaveMensaje));
    } finally {
      establecerContrasena("");
      establecerOcupado(false);
      candado.current = false;
    }
  };
  const entrada = {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.fondo,
    paddingHorizontal: 15,
    fontSize: 16,
    color: colores.texto,
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pantalla titulo={t("acceso")} ayuda={t("accesoAyuda")}>
        <View
          style={{
            minHeight: 132,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 28,
            backgroundColor: colores.verdeSuave,
            marginBottom: 4,
          }}
        >
          <View
            style={{
              padding: 20,
              backgroundColor: colores.tarjeta,
              borderRadius: 24,
            }}
          >
            <ShieldCheck
              size={46}
              strokeWidth={1.5}
              color={colores.verdeTexto}
            />
          </View>
        </View>
        <Tarjeta style={{ gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Texto tipo="pequeno" style={{ fontWeight: "700" }}>
              {t("correo")}
            </Texto>
            <TextInput
              accessibilityLabel={t("correo")}
              value={correo}
              onChangeText={establecerCorreo}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              editable={!ocupado}
              returnKeyType="next"
              onSubmitEditing={() => campoContrasena.current?.focus()}
              style={entrada}
              maxLength={254}
              placeholder="nombre@correo.com"
              placeholderTextColor={colores.secundario}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Texto tipo="pequeno" style={{ fontWeight: "700" }}>
              {t("contrasena")}
            </Texto>
            <View style={{ position: "relative" }}>
              <TextInput
                ref={campoContrasena}
                accessibilityLabel={t("contrasena")}
                value={contrasena}
                onChangeText={establecerContrasena}
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                editable={!ocupado}
                returnKeyType="go"
                onSubmitEditing={() => void ingresar()}
                style={[entrada, { paddingRight: 58 }]}
                maxLength={128}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  visible ? "ocultarContrasena" : "mostrarContrasena",
                )}
                onPress={() => establecerVisible(!visible)}
                style={{
                  position: "absolute",
                  right: 4,
                  top: 3,
                  minWidth: 48,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {visible ? (
                  <EyeOff size={21} color={colores.secundario} />
                ) : (
                  <Eye size={21} color={colores.secundario} />
                )}
              </Pressable>
            </View>
          </View>
          {error ? <Aviso error>{error}</Aviso> : null}
          <Boton
            titulo={t("ingresar")}
            alPulsar={() => void ingresar()}
            ocupado={ocupado}
            icono={<ArrowRight color={colores.blanco} size={20} />}
          />
        </Tarjeta>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingBottom: 20,
          }}
        >
          <ShieldCheck size={16} color={colores.secundario} />
          <Texto tipo="pequeno" color={colores.secundario}>
            {t("accesoSeguro")}
          </Texto>
        </View>
      </Pantalla>
    </KeyboardAvoidingView>
  );
}
