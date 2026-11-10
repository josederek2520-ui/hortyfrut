# HortyFru Chofer

Proyecto Android con React Native, Expo SDK 58 y TypeScript, separado de Backend y Frontend. Consume la API móvil de sesión, despachos y recorridos. El backend decide permisos, confirmaciones y movimientos.

## Estado de esta entrega

Se implementaron sesión segura, operaciones del chofer, mapas, optimización y GPS autorizado en primer plano. El chofer confirma el recorrido y lo fija al iniciar; la web asigna carga y consulta el avance. Las dependencias están fijadas en `package-lock.json`. Pasan **49 pruebas** móviles. El [flujo del chofer](../documentacion/recorrido_chofer.md) y el [informe de la etapa 7](../documentacion/etapa_siete_movil.md) describen el funcionamiento y los comandos **Git Bash**. Esta actualización añade Expo Location y requiere instalar el nuevo APK para utilizar GPS.

El proyecto nativo se genera con Expo Prebuild y **Gradle completó `:app:assembleDebug` correctamente**. El APK actualizado está en `dist/apk/hortyfru-chofer-etapa7-desarrollo.apk` (Android arm64, versión 0.3.0, código 3); se conservan los instaladores anteriores. Se comprobaron firma y manifiesto: permite ubicación en primer plano, sin permiso de ubicación de fondo. Requiere Android 7/API 24 o posterior y Metro (`npm.cmd start`).

El usuario confirmó en el teléfono el mapa, la propuesta y el recorrido coincidente en la web. Falta probar físicamente la señal GPS, permisos y camión de la etapa 7. No se automatizó el escritorio ni el dispositivo.

## Estructura

- `src/app`: rutas y layouts de Expo Router.
- `src/modulos/sesion`: modelos, servicio observable de sesión, acceso HTTP y pantallas de acceso/cuenta.
- `src/modulos/despachos`: contratos de viajes, traducción de DTO y consultas paginadas.
- `src/modulos/recorrido`: selección de la siguiente acción, revisión por pedido, control de operaciones con UUID estable y mapa del plan aprobado.
- `src/modulos/seguimiento`: captura GPS consentida en primer plano, lotes por viaje/dispositivo, estado observable y controles de seguimiento.
- `src/infraestructura`: transporte HTTP y almacenamiento seguro.
- `src/composicion`: conexión de implementaciones con los servicios.
- `src/compartido`: tema claro/oscuro, traducciones es/en, componentes y consultas cancelables.

Los modelos y casos de uso no importan Expo, React Native ni componentes. Las implementaciones de datos respetan los nombres del contrato HTTP y los convierten a modelos en español con camelCase.

## Pantallas

1. Inicio de sesión con correo y contraseña, campo de contraseña protegido y estados de error.
2. Mis viajes, con filtros consultados en el servidor y páginas de diez.
3. Recorrido: vehículo, origen, peso preparado, avance, sucursales y próxima acción.
4. Pedidos de cada sucursal y estado de descarga.
5. Revisión del pedido, cantidades de solo lectura, lotes y checks conservados entre páginas.
6. Cuenta, apariencia clara/oscura, idioma y cierre de sesión con revocación del acceso actual.
7. Mapa amplio con paradas ordenables, cálculo, confirmación e inicio del recorrido, tarjeta contraíble, encuadre y navegación externa.

El diseño usa la marca existente, acentos verdes, fondo neutro, tarjetas blancas en claro y carbón en oscuro, controles de al menos 48 puntos, tipografía del sistema y animaciones de presión mediante Animated. El tema se elige en Cuenta → Apariencia, se guarda en la aplicación y es independiente del teléfono; respeta movimiento reducido. Mis despachos reúne una cabecera compacta con el acceso a la cuenta, filtro desplegable por estado, actualización por gesto o icono y navegación inferior a Viajes y Cuenta. Las tarjetas muestran el próximo destino histórico cuando está disponible, placa, fecha de reparto, sucursales, peso preparado y avance por pedido. El dibujo del vehículo es un icono, sin fotografías ni horarios inventados. Los estados vacíos distinguen ausencia de viajes y filtros sin coincidencias; se mantienen la paginación de diez y el descarte de consultas anteriores.

Las confirmaciones de negocio usan diálogos nativos de Android. La exportación web sirve como apoyo de desarrollo; su mapa indica que debe utilizarse Android. La administración Next.js sí incorpora el mapa web. Los cambios de interfaz se cargan mediante Metro; incorporar o actualizar bibliotecas nativas requiere recompilar e instalar el APK. No se automatiza el teléfono ni el navegador.

## Protección de la operación

- La credencial se guarda con SecureStore. En la vista web de desarrollo se mantiene solo en memoria, sin persistirla en localStorage.
- Las peticiones no envían cookies y se limitan a rutas móviles del servidor configurado. No se siguen redirecciones ni los enlaces `next` de la respuesta.
- En una compilación de producción la URL exige HTTPS. La dirección del servidor es configuración pública; no contiene credenciales de PostgreSQL.
- La revisión conserva la versión del viaje. Si los datos cambian, exige actualizar y revisar nuevamente.
- Un resultado incierto conserva en memoria el mismo UUID y cuerpo. Reintentar no crea otra operación. Las acciones nuevas del viaje quedan bloqueadas hasta comprobar la anterior.
- No se realizan reintentos automáticos de escrituras ni se confirma nada por GPS.
- La aplicación mantiene separadas CANT, UNI, peso real y cajillas. No hay equivalencias, cantidades editables de carga ni cálculos de existencias.
- Al cambiar de cuenta se descartan operaciones y resultados anteriores. Una respuesta 401 de una credencial anterior no cierra la sesión de otra cuenta.
- La cola persistente y el funcionamiento sin conexión se implementarán en la etapa 8. Si se cierra el proceso ahora, primero se consulta el estado real del servidor antes de volver a revisar una entrega.

## Dependencias instaladas

`package.json` fija Expo 58.0.22, React Native 0.88.1 y React 19.3.0, junto con Router, SecureStore, Crypto, Dev Client, System UI, Safe Area, Screens, SVG, Lucide, MapLibre 11.5.1 y Expo Location 58.0.20. System UI y Appearance aplican el tema elegido dentro de la app. SQLite y la recuperación persistente de pendientes siguen en la etapa 8; Django conserva los planes y las posiciones recibidas.

## Instalar y comprobar

Desde esta carpeta:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run comprobar
npm.cmd run comprobar:logica
npm.cmd test
npm.cmd run exportar
npm.cmd run exportar:web
npx.cmd --no-install expo install --check
```

Las exportaciones se guardan por separado en `dist/android` y `dist/web`. La exportación JavaScript/Hermes no es un APK.

Copiar `.env.example` a `.env` y configurar `EXPO_PUBLIC_API_URL`:

- Emulador Android: `http://10.0.2.2:8000/api/v1/` en desarrollo.
- Celular físico: dirección LAN del equipo con Django o un servidor HTTPS accesible. `localhost` del teléfono es el propio teléfono.
- Distribución: servidor HTTPS real. Una dirección ausente o inválida muestra el error de configuración; no se envían credenciales a otro destino.

En la base del sistema se usará una cuenta de chofer con los permisos de las etapas 2 y 3 y un despacho enviado a ella. No se crearon cuentas ni datos de demostración en el sistema habitual.

## Compilación Android y prueba real

Se localizó JDK 21 en el equipo, pero el plugin de React Native exige además un JDK 17. Se preparó Temurin 17 en `.herramientas/java`, verificando su SHA-256 con los metadatos oficiales de Adoptium. Las herramientas oficiales de Android están en `.herramientas/android-sdk`, dentro de esta carpeta y fuera de Git. La compilación usa SDK 37.0, Build Tools 37.0.0, NDK 27.1.12297006 y CMake 3.22.1; no cambia Java ni las variables globales del equipo.

El complemento `complementos/rutasCortasAndroid.cjs` añade `CMAKE_OBJECT_PATH_MAX=240` a los proyectos nativos al compilar en Windows. CMake reduce así las rutas de los objetos antes del límite que encontró Ninja. El ajuste se conserva al regenerar Android y no modifica `node_modules`, el registro de Windows ni el código de las bibliotecas. Véanse la [variable de CMake](https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html) y la [guía de Reanimated para Windows](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/).

El script de compilación usa además una letra libre de unidad como alias temporal del proyecto mediante `subst`. Las herramientas trabajan, por ejemplo, en `R:\Movil`, conservando los archivos en su ubicación original. No reemplaza unidades existentes, y retira únicamente el alias creado por el proceso al terminar. Esta medida evita cambiar la configuración global de rutas largas de Windows; no se utiliza en EAS ni en el teléfono.

El comando desactiva la compilación incremental de Kotlin en este proceso: sus cachés no admiten mezclar el alias y la unidad física. El complemento mantiene las rutas físicas de Codegen y React Native para sus tareas de generación, y registra el ajuste de CMake antes de evaluar los módulos. Estas opciones solo afectan a la compilación local.

Para compilar sin abrir ni instalar nada en un dispositivo:

```powershell
npm.cmd run compilar:android
```

El script genera un APK **de desarrollo** para Android arm64 en `dist/apk/hortyfru-chofer-desarrollo.apk`. Requiere Metro (`npm.cmd start`), la URL accesible de Django y un teléfono conectado a la misma red. No es el instalador definitivo ni permite usar el flujo sin conexión. Admite `--java`, `--sdk` y `--arquitecturas` después de `npm.cmd run compilar:android --` para otro entorno compatible.

`eas.json` define perfiles `desarrollo` y `piloto`; no se subió el proyecto a EAS ni se accedió a una cuenta externa. El APK autónomo del piloto necesita configurar antes la URL HTTPS real y la firma correspondiente. Mapas, optimización y GPS en primer plano están implementados; el segundo plano corresponde a la etapa 8.

La prueba de campo debe validar inicio de sesión, teclado, tamaño de letra, claro/oscuro, movimiento reducido, llegada, dos pedidos en una sucursal, revisión entre páginas, corte de conexión/reintento, cierre de sesión y permisos. Todavía no se realizó.

## Auditoría de dependencias

La revisión del 1 de noviembre de 2026, después de aplicar los parches compatibles de Expo, registra **13 avisos moderados**, sin avisos altos ni críticos en `Movil`. Incluyen dependencias transitivas y propagación por la cadena de herramientas de Expo. No se forzó una actualización mayor ni el descenso de Expo sugerido por `npm audit fix --force`.

Estos avisos quedan abiertos para su revisión y actualización compatible. Las compilaciones y el servidor de desarrollo deben usar configuración y paquetes de confianza. Repetir `npm audit` antes de distribuir el piloto. El informe de la etapa 5 documenta también los avisos existentes del frontend web.

## Referencias de diseño y plataforma

- [Estructura de Expo Router](https://docs.expo.dev/router/basics/core-concepts/).
- [Compatibilidad del SDK de Expo](https://docs.expo.dev/versions/v58.0.0/).
- [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).
- [Listas de Material Design](https://m3.material.io/components/lists/overview).
- [Compilaciones de desarrollo](https://docs.expo.dev/develop/development-builds/introduction/).

Se usaron también los principios de jerarquía, contención y movimiento de la skill local apple-design, adaptados a controles nativos de Android. No se trasladaron CSS o bibliotecas de animación web al proyecto móvil.
