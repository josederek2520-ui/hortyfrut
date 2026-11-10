import type { ExpoConfig } from "expo/config";
import { configurarRutasCortasAndroid } from "./complementos/rutasCortasAndroid.cjs";

const configuracion: ExpoConfig = {
  name: "HortyFru Chofer",
  slug: "hortyfru-chofer",
  version: "0.3.0",
  scheme: "hortyfru",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  android: {
    package: "com.hortyfru.chofer",
    versionCode: 3,
    // Etapa 7: ubicación consentida en primer plano, sin permiso de fondo.
    blockedPermissions: ["android.permission.ACCESS_BACKGROUND_LOCATION"],
    softwareKeyboardLayoutMode: "resize",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@maplibre/maplibre-react-native",
    [
      "expo-location",
      {
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  web: { bundler: "metro", output: "single" },
};
export default configurarRutasCortasAndroid(configuracion);
