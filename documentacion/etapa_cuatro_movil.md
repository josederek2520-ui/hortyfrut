# Etapa 4: aplicación Android del chofer

30 de octubre de 2026

## Estado real

Se creó `Movil/` junto a `Backend/` y `Frontend/`, con React Native, Expo, TypeScript y una arquitectura modular por capas. El usuario autorizó instalar las dependencias necesarias dentro de `Movil`; se instalaron y se generó `package-lock.json`. Pasan los tipos completos, las pruebas y las exportaciones Android y web. **El APK de desarrollo se compiló correctamente** con Expo Prebuild y Gradle.

La prueba de un recorrido real en un teléfono sigue pendiente. La etapa **todavía no se considera cerrada** hasta comprobar acceso, llegada, revisión, descarga y regreso al almacén con los datos reales. No se automatizó el escritorio ni se operaron dispositivos.

## Código preparado

- Sesión por dispositivo, almacenamiento seguro nativo y revocación al cerrar sesión.
- Consulta paginada de viajes propios con filtros de estado en el servidor.
- Detalle del recorrido, origen, vehículo, carga preparada, sucursales y avance.
- Siguiente acción según permisos, envío, capacidad, llegada y estado real del viaje.
- Pedidos de cada sucursal y revisión de sus productos y lotes.
- Checks conservados entre páginas; se exige revisar todas las filas transportadas del pedido.
- Confirmación con versión y UUID estable en reintentos; bloqueo de dobles envíos y operaciones pendientes de comprobar.
- Traducciones es/en, tema claro/oscuro, marca HortyFru, fondo verde suave, tarjetas blancas, tipografía del sistema y controles de al menos 48 puntos.
- Animación nativa de presión y transición entre pantallas, con respeto por movimiento reducido.

No se modificaron las reglas del backend ni del frontend web durante esta preparación. La aplicación utiliza los endpoints móviles de las etapas 2 y 3. No convierte cajas o unidades en kilos, no edita cantidades preparadas y no calcula movimientos de inventario.

## Arquitectura

`src/app` contiene rutas de Expo Router. Los módulos `sesion`, `despachos` y `recorrido` separan dominio, aplicación, datos y presentación. `src/composicion` conecta los contratos con sus adaptadores. `src/infraestructura` contiene HTTP y SecureStore; `src/compartido` contiene tema, componentes y traducciones.

Los modelos y casos de uso no importan Expo o React Native. Los contratos HTTP se convierten a modelos propios con nombres en español y camelCase. La autorización definitiva y las transacciones continúan en Django.

## Verificaciones ejecutadas

Pasaron trece pruebas de lógica y transporte: URL HTTPS, alcance de credenciales, respuesta 401 de una cuenta anterior, checks entre páginas, conservación de UUID/cuerpo, dobles toques, conflictos, cambio de cuenta, restauración de sesión y aislamiento de las capas. Incluyen limpieza del almacenamiento antes de otro acceso y respuestas de restauración atrasadas que no sustituyen ni eliminan una credencial nueva. También se comprobó la paridad de traducciones y que las listas no admitan más de diez registros por página.

Pasaron `npm run comprobar`, `npm run comprobar:logica`, `npm test` y `expo install --check` usando las dependencias de `Movil`. Se corrigieron las diferencias de React Native 0.88 y Expo Router 58 en las referencias a campos y la prevención de salida durante operaciones o revisiones pendientes. Las exportaciones se generan por separado en `dist/android` (Hermes) y `dist/web`. Una exportación no equivale a un APK ni a una prueba visual o de campo.

Las herramientas nativas oficiales se prepararon dentro de `Movil/.herramientas`. El comando `npm run compilar:android` terminó con `BUILD SUCCESSFUL`, 483 tareas y 4 min 27 s en la compilación final. El script utiliza un alias temporal de ruta, opciones locales de CMake y Kotlin, y retira el alias al terminar. No se cambió la configuración global de Windows ni se modificaron bibliotecas de terceros.

El APK está en `Movil/dist/apk/hortyfru-chofer-desarrollo.apk`: paquete `com.hortyfru.chofer`, versión 0.1.0, arm64, Android API 24 o posterior y 91,5 MB. `apksigner verify --verbose` comprobó la firma v2 y `aapt dump badging` comprobó el manifiesto. No se instaló ni abrió en un dispositivo. El APK de desarrollo requiere Metro; el instalador autónomo necesita antes la URL HTTPS del servidor y la firma del piloto.

SHA-256 del APK: `150a47e0fdd08a223b3244591aa8d480648c92acfb0343f2264b877117a1ab53`.

La auditoría npm mantiene ocho avisos transitivos en las herramientas de Expo, derivados de Zod y deepmerge. No se aplicó una actualización mayor incompatible para ocultarlos. La [guía móvil](../Movil/README.md#auditoría-de-dependencias) documenta versiones, referencias y el seguimiento pendiente antes de distribuir el piloto.

## Falta para completar esta etapa

1. Configurar la dirección accesible de Django y usar una cuenta de chofer y un viaje real enviado a ella.
2. Probar en un teléfono: acceso, teclado, letra grande, claro/oscuro, movimiento reducido, llegada, dos pedidos, checks entre páginas, corte de conexión/reintento y finalización al regresar al almacén.

Las coordenadas pueden completarse antes de las pruebas de mapas. No se crearon usuarios ni despachos de demostración en la base habitual. Las claves de firma y el APK de distribución definitivo corresponden a su etapa del plan.

La [guía de Movil](../Movil/README.md) detalla los comandos, la configuración, las limitaciones y las referencias de diseño consultadas.
