import { useEffect, useRef } from "react";
import {
  Animated,
  ActivityIndicator,
  Pressable,
  Text,
  View,
  StyleSheet,
  Image,
  ScrollView,
  StatusBar,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Route,
  UserRound,
} from "lucide-react-native";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { codigoError } from "@/compartido/dominio/Errores";

export function Texto({
  children,
  tipo = "cuerpo",
  color,
  style,
}: {
  children: React.ReactNode;
  tipo?: "titulo" | "subtitulo" | "cuerpo" | "pequeno" | "numero";
  color?: string;
  style?: StyleProp<import("react-native").TextStyle>;
}) {
  const { colores } = usarInterfaz();
  return (
    <Text style={[estilos[tipo], { color: color ?? colores.texto }, style]}>
      {children}
    </Text>
  );
}
export function Tarjeta({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colores } = usarInterfaz();
  return (
    <View
      style={[
        estilos.tarjeta,
        { backgroundColor: colores.tarjeta, borderColor: colores.borde },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Boton({
  titulo,
  alPulsar,
  ocupado = false,
  deshabilitado = false,
  secundario = false,
  icono,
  iconoAlFinal = false,
}: {
  titulo: string;
  alPulsar: () => void;
  ocupado?: boolean;
  deshabilitado?: boolean;
  secundario?: boolean;
  icono?: React.ReactNode;
  iconoAlFinal?: boolean;
}) {
  const { colores, reducirMovimiento } = usarInterfaz();
  const escala = useRef(new Animated.Value(1)).current;
  const animar = (valor: number) => {
    escala.stopAnimation();
    if (reducirMovimiento) escala.setValue(1);
    else
      Animated.spring(escala, {
        toValue: valor,
        damping: 26,
        stiffness: 320,
        mass: 0.7,
        useNativeDriver: true,
      }).start();
  };
  useEffect(() => {
    if (reducirMovimiento) {
      escala.stopAnimation();
      escala.setValue(1);
    }
    return () => escala.stopAnimation();
  }, [reducirMovimiento, escala]);
  const inactivo = ocupado || deshabilitado;
  return (
    <Animated.View
      style={{ transform: [{ scale: escala }], opacity: inactivo ? 0.55 : 1 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={titulo}
        accessibilityState={{ disabled: inactivo, busy: ocupado }}
        disabled={inactivo}
        onPress={alPulsar}
        onPressIn={() => animar(0.98)}
        onPressOut={() => animar(1)}
        style={[
          estilos.boton,
          {
            backgroundColor: secundario ? colores.tarjeta : colores.verde,
            borderColor: secundario ? colores.borde : colores.verde,
          },
        ]}
      >
        {ocupado ? (
          <ActivityIndicator
            color={secundario ? colores.verde : colores.blanco}
          />
        ) : !iconoAlFinal ? (
          icono
        ) : null}
        <Texto
          style={{ fontWeight: "700", textAlign: "center" }}
          color={secundario ? colores.texto : colores.blanco}
        >
          {titulo}
        </Texto>
        {!ocupado && iconoAlFinal && icono}
      </Pressable>
    </Animated.View>
  );
}
export function MarcaHortyfru({ compacta = false }: { compacta?: boolean }) {
  const { oscuro } = usarInterfaz();
  return (
    <Image
      accessibilityLabel="HortyFru"
      source={
        oscuro
          ? require("../../../assets/marca-oscura.png")
          : require("../../../assets/marca-clara.png")
      }
      resizeMode="contain"
      style={{ width: compacta ? 120 : 145, height: compacta ? 40 : 48 }}
    />
  );
}
export function Pantalla({
  titulo,
  ayuda,
  children,
  pie,
  volver = false,
  cuenta = false,
  cabeceraPersonalizada,
  alActualizar,
  actualizando = false,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  volver?: boolean;
  cuenta?: boolean;
  cabeceraPersonalizada?: React.ReactNode;
  alActualizar?: () => void;
  actualizando?: boolean;
}) {
  const { colores, oscuro, t } = usarInterfaz(),
    navegador = useRouter();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      edges={["top", "bottom"]}
    >
      <StatusBar barStyle={oscuro ? "light-content" : "dark-content"} />
      <View style={estilos.cabecera}>
        {cabeceraPersonalizada ?? (
          <>
            {volver ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("volver")}
                onPress={() =>
                  navegador.canGoBack()
                    ? navegador.back()
                    : navegador.replace("/(chofer)/viajes")
                }
                style={estilos.icono}
              >
                <ArrowLeft color={colores.texto} size={24} />
              </Pressable>
            ) : (
              <MarcaHortyfru />
            )}
            {cuenta && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("verCuenta")}
                onPress={() => navegador.push("/(chofer)/cuenta")}
                style={[
                  estilos.icono,
                  {
                    borderWidth: 1,
                    borderRadius: 16,
                    borderColor: colores.borde,
                    backgroundColor: colores.tarjeta,
                  },
                ]}
              >
                <UserRound color={colores.verdeTexto} size={23} />
              </Pressable>
            )}
          </>
        )}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          alActualizar ? (
            <RefreshControl
              refreshing={actualizando}
              onRefresh={alActualizar}
              tintColor={colores.verdeTexto}
              colors={[colores.verde]}
              progressBackgroundColor={colores.tarjeta}
            />
          ) : undefined
        }
        contentContainerStyle={{
          padding: 20,
          paddingTop: 4,
          gap: 16,
          flexGrow: 1,
        }}
      >
        <View style={{ gap: 7 }}>
          <Texto tipo="titulo">{titulo}</Texto>
          {ayuda && <Texto color={colores.secundario}>{ayuda}</Texto>}
        </View>
        {children}
      </ScrollView>
      {pie && (
        <View
          style={{
            padding: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderColor: colores.borde,
            backgroundColor: colores.tarjeta,
            gap: 10,
          }}
        >
          {pie}
        </View>
      )}
    </SafeAreaView>
  );
}
export function EstadoCarga({
  error,
  alReintentar,
}: {
  error?: unknown;
  alReintentar?: () => void;
}) {
  const { colores, t } = usarInterfaz();
  return (
    <Tarjeta style={{ paddingVertical: 32, alignItems: "center", gap: 16 }}>
      {error ? (
        <AlertCircle size={30} color={colores.error} />
      ) : (
        <ActivityIndicator size="large" color={colores.verde} />
      )}
      <Texto color={error ? colores.error : colores.secundario}>
        {error
          ? t(
              `error_${codigoError(error)}` as import("@/compartido/traducciones/mensajes").ClaveMensaje,
            )
          : t("cargando")}
      </Texto>
      {!!error && alReintentar && (
        <Boton titulo={t("reintentar")} alPulsar={alReintentar} secundario />
      )}
    </Tarjeta>
  );
}
export function Aviso({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  const { colores } = usarInterfaz();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: error ? colores.errorFondo : colores.naranja,
      }}
    >
      <Texto
        tipo="pequeno"
        color={error ? colores.error : colores.naranjaTexto}
      >
        {children}
      </Texto>
    </View>
  );
}
export function Paginador({
  pagina,
  total,
  alCambiar,
  ocupado = false,
}: {
  pagina: number;
  total: number;
  alCambiar: (pagina: number) => void;
  ocupado?: boolean;
}) {
  const { t, colores } = usarInterfaz();
  const paginas = Math.max(1, Math.ceil(total / 10));
  if (paginas <= 1) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Pressable
        accessibilityLabel={t("anterior")}
        accessibilityRole="button"
        disabled={pagina <= 1 || ocupado}
        onPress={() => alCambiar(pagina - 1)}
        style={[estilos.icono, { opacity: pagina <= 1 ? 0.3 : 1 }]}
      >
        <ChevronLeft color={colores.texto} />
      </Pressable>
      <Texto tipo="pequeno">{t("pagina", { pagina, total: paginas })}</Texto>
      <Pressable
        accessibilityLabel={t("siguiente")}
        accessibilityRole="button"
        disabled={pagina >= paginas || ocupado}
        onPress={() => alCambiar(pagina + 1)}
        style={[estilos.icono, { opacity: pagina >= paginas ? 0.3 : 1 }]}
      >
        <ChevronRight color={colores.texto} />
      </Pressable>
    </View>
  );
}
export function IconoRuta() {
  const { colores } = usarInterfaz();
  return (
    <View
      style={{
        padding: 14,
        backgroundColor: colores.verdeSuave,
        borderRadius: 18,
        alignSelf: "flex-start",
      }}
    >
      <Route color={colores.verdeTexto} size={26} />
    </View>
  );
}
const estilos = StyleSheet.create({
  titulo: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: "700",
  },
  subtitulo: {
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.3,
    fontWeight: "700",
  },
  cuerpo: { fontSize: 15, lineHeight: 22 },
  pequeno: { fontSize: 13, lineHeight: 20 },
  numero: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.7,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  tarjeta: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  boton: {
    minHeight: 52,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  cabecera: {
    minHeight: 68,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icono: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
