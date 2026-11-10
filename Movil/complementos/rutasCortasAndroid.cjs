const { withProjectBuildGradle } = require("expo/config-plugins");
const { realpathSync } = require("node:fs");

// CMake acorta los objetos antes de que Ninja alcance MAX_PATH en Windows.
const ajuste = `
// HortyFru: rutas cortas para los objetos nativos en Windows.
if (System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("windows")) {
  def raizFisicaHortyfru = new File(__RAIZ_FISICA_HORTYFRU__)
  subprojects { proyecto ->
    proyecto.plugins.withId("com.facebook.react") {
      def configuracionReact = proyecto.extensions.getByName("react")
      proyecto.afterEvaluate {
        configuracionReact.getCodegenDir().set(new File(raizFisicaHortyfru, "node_modules/@react-native/codegen"))
        configuracionReact.getReactNativeDir().set(new File(raizFisicaHortyfru, "node_modules/react-native"))
      }
    }
    ["com.android.library", "com.android.application"].each { identificador ->
      proyecto.plugins.withId(identificador) {
        proyecto.androidComponents.finalizeDsl { configuracionNativa ->
          configuracionNativa.defaultConfig.externalNativeBuild.cmake.arguments.removeAll { it.startsWith("-DCMAKE_OBJECT_PATH_MAX=") }
          configuracionNativa.defaultConfig.externalNativeBuild.cmake.arguments.add("-DCMAKE_OBJECT_PATH_MAX=240")
        }
      }
    }
  }
}
`;

/** @type {import("expo/config-plugins").ConfigPlugin} */
const configurarRutasCortasAndroid = (configuracion) =>
  withProjectBuildGradle(configuracion, (resultado) => {
    if (resultado.modResults.language !== "groovy")
      throw Error(
        "El ajuste de rutas Android requiere build.gradle de Groovy.",
      );
    if (
      !resultado.modResults.contents.includes("-DCMAKE_OBJECT_PATH_MAX=240")
    ) {
      const marcador = 'apply plugin: "expo-root-project"';
      const posicion = resultado.modResults.contents.indexOf(marcador);
      if (posicion < 0)
        throw Error(
          "No se encontro el inicio de los complementos Android de Expo.",
        );
      // Registrar finalizeDsl antes de que los complementos evaluen la app.
      const raizFisica = (
        process.env.HORTYFRU_RAIZ_FISICA ??
        realpathSync(resultado.modRequest.projectRoot)
      ).replaceAll("\\", "/");
      const bloque = ajuste.replace(
        "__RAIZ_FISICA_HORTYFRU__",
        "'" + raizFisica.replaceAll("'", "\\'") + "'",
      );
      resultado.modResults.contents =
        resultado.modResults.contents.slice(0, posicion) +
        bloque +
        resultado.modResults.contents.slice(posicion);
    }
    return resultado;
  });

module.exports = { configurarRutasCortasAndroid };
