# Plan por etapas para la aplicación móvil y seguimiento de HortyFru

Versión 2.6 · 4 de noviembre de 2026

Actualización del 4 de noviembre: se preparó el [acceso HTTPS temporal del chofer
con Cloudflare](../infraestructura/chofer_https/README.md), con administración local
y entrada pública restringida. Se implementó la [etapa 9 de supervisión web](etapa_nueve_web.md),
con GPS web cada 3 segundos y administrador local. La prueba física sigue pendiente.
La supervisión se consulta desde **Seguimiento de camiones** en el menú lateral;
Despachos conserva un enlace al viaje. Se corrigieron la carga del worker del
mapa y las traducciones de las operaciones de rutas.
El listado de **Mis viajes** incorpora la barra superior y el menú lateral
adaptables del sistema; el mapa del viaje conserva su pantalla completa.

Se incorporó además [Chat para todos los Usuarios activos](chat_web.md), con
conversaciones privadas, WebSocket y el audio de notificación proporcionado. Es un
módulo independiente de las etapas del recorrido. El acceso HTTPS permite Chat y
Mis viajes según permisos; la administración y la supervisión GPS siguen locales.

## Cambio de dirección: chofer en la web

Por decisión del usuario, se adaptó el flujo de las etapas 1 a 6 y el GPS en primer
plano a **Mis viajes** en Next.js, con mapa amplio para el teléfono. Se conservan
los servicios, permisos y reglas operativas, y `Movil/` permanece disponible hasta
validar físicamente la alternativa web. El [informe de adaptación](adaptacion_chofer_web.md)
describe el acceso, el procedimiento y las comprobaciones. El GPS web requiere HTTPS.

Las etapas y los informes Android siguientes conservan el historial del desarrollo.
La etapa 8 nativa (SQLite/segundo plano) y el APK autónomo de la etapa 10 dejan de
ser el siguiente trabajo de esta alternativa: antes se validará el reparto web.
No se implementaron por esta adaptación funcionamiento offline ni guía giro a giro.
La supervisión GPS web en vivo se incorporó en la etapa 9. La app móvil todavía no se ha eliminado.

## Estado de la etapa cero

La revisión técnica quedó completada el 30 de octubre de 2026. Se preparó una base PostgreSQL de pruebas separada y pasaron 438 pruebas de backend y 143 de frontend, además de compilación y controles de código. El [informe de la etapa cero](etapa_cero_movil.md) contiene contratos, responsabilidades y adaptaciones verificadas.

Reglas confirmadas por el usuario: el recorrido del piloto incluye el regreso al mismo almacén de salida; la futura publicación se bloquea si falta capacidad declarada o si el peso preparado la supera. Las funciones nuevas siguen pendientes de sus etapas y el comportamiento de los viajes actuales se conserva.

## Estado de la etapa 1

Implementación lista; datos reales pendientes de confirmación por el usuario. Se añadió la comprobación de capacidad en Django antes de iniciar el viaje y su aviso en la interfaz, manteniendo toneladas visibles y kg internos. Los borradores pueden conservarse con datos pendientes. La comprobación queda disponible para la publicación de la etapa 2.

El usuario completó las coordenadas de Almacén Central y las sucursales; se comprobó que OSRM devuelve un recorrido con esos puntos. Los accesos reales y la capacidad declarada se revisan antes de salir. El [informe de la etapa 1](etapa_uno_movil.md) conserva los antecedentes y las validaciones implementadas.

## Estado de la etapa 2

Implementada la acción «Enviar al chofer», su evidencia y el acceso móvil por dispositivo, con consulta y operaciones limitadas a los viajes propios. La web muestra «Pendiente de salida» después del envío. Se conserva la sesión web, la API anterior y la descarga por parada; la descarga por pedido corresponde a la etapa 3. El [informe de la etapa 2](etapa_dos_movil.md) contiene permisos, contratos, configuración y datos para las pruebas futuras. La aplicación Android y el APK corresponden a la etapa 4 en adelante.

## Estado de la etapa 3

Implementada la descarga por pedido en la API del chofer y el seguimiento en la web. Se conserva una sola parada por sucursal; las cajillas se entregan una sola vez al completar sus pedidos y los productos no se descuentan nuevamente. El historial anterior conserva sus fechas conocidas, sin inventar responsables por pedido. El [informe de la etapa 3](etapa_tres_movil.md) describe contratos, compatibilidad y pruebas. La aplicación Android utilizará este flujo desde la etapa 4.

## Estado de la etapa 4

Se implementó `Movil/` con las pantallas y las capas del flujo manual. Con la autorización del usuario se instalaron las dependencias y se fijó el lockfile. Pasaron TypeScript, pruebas, compatibilidad de Expo y exportaciones Android/web. **Se generó el APK de desarrollo y se verificaron su firma y manifiesto**. El usuario ya accedió a la app y confirmó que el mapa se ve en el teléfono. Queda la prueba física completa del reparto. El APK requiere Metro y no es el instalador autónomo del piloto. El [informe de la etapa 4](etapa_cuatro_movil.md) conserva el archivo y las comprobaciones iniciales; la etapa 6 amplía sus funciones y pruebas.

## Estado de la etapa 5

Implementados los mapas con MapLibre Native en Android y React Leaflet con MapLibre en la web, cartografía de OpenFreeMap/OpenStreetMap y OSRM local con datos de Bolivia. Por decisión del usuario del 3 de noviembre, Despachos web asigna carga, vehículo, chofer y cajillas y envía el viaje; el chofer ordena, calcula y confirma su recorrido desde el celular. La salida fija la versión confirmada. Incluye todas las paradas y el regreso al mismo almacén, sin tráfico en vivo. La app conserva el mapa amplio, tarjeta contraíble y tema claro/oscuro independiente del sistema.

La migración está aplicada y el APK de desarrollo existente carga estos cambios mediante Metro, sin nuevas bibliotecas nativas. Las coordenadas están registradas y el usuario confirmó que el mapa se ve en el teléfono. La prueba física completa del reparto sigue siendo manual. Los planes históricos fijados conservan su evidencia y los viajes sin plan permiten el flujo manual. El [flujo del chofer](recorrido_chofer.md) explica el procedimiento vigente; el [informe de la etapa 5](etapa_cinco_movil.md) incluye los comandos Bash y las limitaciones. La optimización corresponde a la etapa 6 implementada a continuación; GPS y funcionamiento sin conexión conservan sus etapas posteriores.

## Estado de la etapa 6

Implementada la optimización con un genético propio apoyado en DEAP y matriz dirigida de tiempos de OSRM, sin tráfico ni tiempos de descarga. El chofer solicita el cálculo desde el mapa, revisa y confirma la propuesta. Django y PostgreSQL conservan evidencia y Celery/Redis ejecutan el trabajo en Docker. La web consulta la ruta y métricas; las comparaciones académicas permanecen fuera del flujo del chofer. Se integraron los SVG aportados y colores por sucursal/tramo, manteniendo la geometría histórica.

Se verificó el flujo completo en una base separada con OSRM y trabajador reales. Se entregan cuaderno, matrices, calibración, 180 ejecuciones y gráficas reproducibles. El usuario confirmó en el teléfono la propuesta, los destinos/iconos/colores y el recorrido aprobado coincidente con la web. El [informe de la etapa 6](etapa_seis_movil.md) describe arquitectura, límites, API, comprobaciones y comandos. La función objetivo sigue siendo tiempo total estimado, no kilómetros.

## Estado de la etapa 7

Implementada la captura GPS consentida en primer plano con Expo Location, API del chofer y PostgreSQL. Compartir se ofrece por separado de iniciar el viaje. Incluye el camión aportado, precisión y hora, detener, centrado, sesiones por viaje/dispositivo, lotes idempotentes, controles de calidad, alcance propio y auditoría. Pasar a segundo plano detiene la captura y volver no la reactiva automáticamente. El cierre del viaje y la revocación del acceso cierran el seguimiento del servidor.

Se generó el APK de desarrollo 0.3.0/código 3 con los permisos de primer plano y sin permiso de ubicación de fondo; requiere instalar esta actualización y usar Metro. Se aplicó la migración con respaldo y conservación verificada de los datos anteriores. Pasaron las pruebas técnicas; falta la prueba de GPS en el teléfono real. El [informe de la etapa 7](etapa_siete_movil.md) contiene los pasos y límites. La persistencia sin conexión y el segundo plano siguen en la etapa 8; la supervisión web en vivo, en la etapa 9.

## Estado de la etapa 9 en la alternativa web

Implementada la supervisión por despacho con Channels/Daphne y Redis. El administrador
ve el almacén, las sucursales y sus SVG/colores, el recorrido confirmado y el camión
solo con una medición GPS válida. El chofer web acepta muestras como máximo cada
3 segundos; el navegador y la red pueden tardar más. Incluye precisión, hora,
estado de GPS y conexión, datos antiguos, reconexión y cámara opcional.

La administración permanece local y el chofer usa su entrada HTTPS de Cloudflare.
Se mantienen sesión/CSRF, autorización, UUID, auditoría y lógica de las etapas
anteriores. No requiere implementar la etapa 8 nativa para este alcance en primer
plano. El [informe de etapa 9](etapa_nueve_web.md) explica los comandos, la
arquitectura y la prueba física pendiente. La tabla y las etapas Android siguientes
conservan el plan original como historial.

## 1 Decisión principal sobre las bases de datos

PostgreSQL seguirá siendo la base de datos principal de HortyFru. Django continuará guardando allí usuarios, pedidos, preparaciones, despachos, descargas, planes de ruta y ubicaciones GPS. La aplicación Android y el sistema web consultarán el mismo backend.

SQLite se propone únicamente dentro del celular. Guardará una copia de los viajes asignados y una cola de ubicaciones y operaciones pendientes cuando no haya Internet. No reemplaza PostgreSQL ni decide por sí sola que una descarga quedó confirmada.

Flujo de datos propuesto

    Aplicación Android → API de Django → PostgreSQL
           ↓                    ↓
       SQLite local       Channels y Redis → mapa del administrador

| Tecnología | Dónde funciona | Qué guarda o transmite |
| --- | --- | --- |
| PostgreSQL | Servidor de HortyFru | Información oficial y persistente de toda la operación |
| SQLite | Cada celular Android | Copia local de sus viajes y operaciones pendientes de sincronizar |
| Redis | Infraestructura del servidor | Distribución de avisos en vivo y apoyo a tareas según el diseño elegido |

El celular se comunicará con Django mediante la API. No incorporaremos la contraseña de PostgreSQL en el APK ni conectaremos el teléfono directamente a la base central. Django será quien aplique permisos, versiones, auditoría y reglas de negocio.

### Si queremos empezar sin SQLite

Podemos construir una primera versión siempre conectada que use solamente la API y PostgreSQL. Servirá para validar pantallas y operaciones. Si el proceso del celular se cierra, una cola guardada solo en memoria no conservará los datos pendientes.

Recomiendo incorporar SQLite antes de las pruebas de reparto con pérdida de señal. Expo permite guardar una base SQLite que persiste entre reinicios de la aplicación [1]. Las credenciales se guardarán por separado en almacenamiento seguro del dispositivo.

## 2 Punto de partida del sistema

El proyecto existente ya utiliza Django y DRF, PostgreSQL y Next.js con TypeScript. Las siguientes capacidades se reutilizan.

| Área | Estado observado | Adaptación necesaria |
| --- | --- | --- |
| Usuarios y roles | Usuarios y permisos existentes; el chofer es un Usuario autorizado | Acceso móvil, credenciales por dispositivo y permisos sobre sus propios viajes |
| Vehículos | Catálogo con capacidad opcional y presentación en toneladas | Verificación de capacidad en backend y tratamiento explícito de datos faltantes |
| Clientes y almacenes | Sucursales y almacenes admiten coordenadas | Completar y verificar los puntos que se utilizarán para calcular rutas |
| Preparaciones | Cantidades atendidas y aportes reales de lotes; confirmación descuenta productos | Conservar la trazabilidad al presentar la carga en el celular |
| Despachos | Carga por pedido, paradas por sucursal, vehículo, chofer, cajillas y versiones | Separar publicación y salida real; ampliar la descarga por pedido |
| Recorrido | Acciones administrativas de iniciar, llegar, descargar y finalizar | Reutilizar servicios con una política de acceso para el chofer asignado |
| Rutas y GPS | No se identificaron módulos implementados para estas funciones | Incorporar planificación, sesiones GPS y supervisión |
| Aplicación móvil | No se identificó un proyecto móvil dentro del repositorio | Crear el proyecto Android de forma separada del frontend web |

Actualmente la descarga se registra para toda una parada. El documento funcional anterior pide descargar cada pedido dentro de esa parada. Esa adaptación debe resolverse antes de considerar completo el flujo móvil.

La selección de Despachos puede incluir atención parcial confirmada. Por eso la descarga y la conciliación deberán identificar exactamente la carga de ese pedido en ese viaje, sin asumir que siempre viaja el pedido entero.

## 3 Reglas que debemos conservar

1. El despacho utiliza carga preparada y confirmada que sigue disponible. La fecha requerida del pedido y la fecha de reparto son independientes.
2. Una sucursal constituye una sola parada, aunque el viaje transporte varios de sus pedidos.
3. El chofer solo puede consultar y operar sus viajes autorizados. El backend comprobará esta condición en cada operación.
4. Los responsables siguen siendo Usuarios. No se creará un módulo de Empleados.
5. Publicar un viaje para el chofer no registra la salida física. La salida real se registra al iniciar el recorrido.
6. Compartir GPS será voluntario y visible. Negar ese permiso no equivale a cancelar el reparto ni a confirmar operaciones.
7. La llegada, la descarga y el cierre del viaje serán acciones explícitas. La cercanía GPS no las confirma automáticamente.
8. Confirmar Preparaciones ya descuenta productos. Iniciar, descargar y conciliar Entregas no repetirán ese descuento.
9. Cajas, unidades y cantidades físicas medidas conservarán sus significados independientes. No se crearán equivalencias supuestas.
10. Las cajillas se contabilizarán por color y cantidades enteras. Su entrega no se duplicará al confirmar varios pedidos de una parada.
11. Confirmar descarga desde el celular no confirma los pesos comerciales aceptados por la sucursal. Esa revisión corresponde a Entregas.
12. Las operaciones de negocio conservarán auditoría, transacciones, versión e identificadores para admitir reintentos sin duplicación.
13. Los listados de negocio conservarán páginas de 10 registros. La optimización y los controles de saldo deben considerar el documento completo, no solo la página visible.

## 4 Arquitectura propuesta

### Aplicación móvil

Crear un proyecto Movil con React Native, Expo y TypeScript. Usar una arquitectura modular por funcionalidades y capas.

- Presentación: pantallas, navegación, mapas, formularios y estados visibles.
- Aplicación: coordinar consultar viaje, iniciar recorrido, registrar llegada, descargar y sincronizar.
- Dominio: modelos y validaciones locales que ayudan al usuario; las reglas oficiales siguen en Django.
- Datos: clientes HTTP, acceso a SQLite, caché y cola de operaciones.
- Servicios del dispositivo: ubicación, permisos, conectividad y almacenamiento seguro.

Organizar las funcionalidades en sesion, despachos, recorrido y seguimiento. Las rutas de navegación estarán en src/app y los componentes y servicios fuera de esa carpeta, respetando Expo Router [2].

La lógica GPS y de sincronización no dependerá de que una pantalla de mapa siga abierta. Esto permite mantener el seguimiento cuando el usuario consulta otro apartado, dentro de las capacidades del sistema operativo.

### Backend y administración

Mantener el monolito modular de Django. Reutilizar despachos, vehiculos, preparaciones, cajillas y usuarios. Incorporar rutas y seguimiento como responsabilidades separadas, con nombres propios en español y sin mover innecesariamente los módulos existentes.

Next.js seguirá siendo la aplicación administrativa. El administrador y el chofer leerán la misma versión aprobada del recorrido, con los mismos destinos y geometría.

Los cálculos de rutas serán tareas fuera de la petición HTTP cuando su duración lo requiera. Se conservarán el resultado y el estado del trabajo para consultarlos después.

## 5 Orden de trabajo

Cada etapa tiene un resultado comprobable. La siguiente se desarrolla sobre los contratos y pruebas de la anterior.

| Etapa | Resultado principal | Depende de |
| --- | --- | --- |
| 0 | Base revisada y decisiones operativas registradas | Sistema actual y documentos |
| 1 | Orígenes, destinos y capacidad preparados | Etapa 0 |
| 2 | Publicación y API del chofer con acceso limitado | Etapas 0 y 1 |
| 3 | Descarga por pedido integrada con las paradas y cajillas | Etapa 2 |
| 4 | Aplicación Android con un recorrido manual completo | Etapas 2 y 3 |
| 5 | Mapas y recorridos por carretera compartidos | Etapas 1 y 4 |
| 6 | Optimización y comparación de algoritmos | Etapa 5 |
| 7 | GPS autorizado en primer plano | Etapa 4 y base de seguimiento |
| 8 | Sincronización sin conexión y GPS en segundo plano | Etapas 4 y 7 |
| 9 | Supervisión en vivo desde el sistema web | Etapas 7 y 8 |
| 10 | APK firmado y pruebas de campo | Etapas 4 a 9 |
| 11 | Conciliación comercial en Entregas | Descargas confirmadas y trazabilidad disponibles |

Las etapas de GPS y optimización pueden avanzar de forma independiente cuando sus bases estén listas. No es necesario terminar el algoritmo genético para comprobar un viaje manual desde el celular.

## Etapa 0 Revisar la base y fijar las reglas operativas

Objetivo: comenzar sobre el sistema existente y evitar cambios incompatibles.

Trabajo

1. Revisar modelos, permisos, servicios, endpoints y pruebas de Despachos, Preparaciones y Cajillas.
2. Identificar los campos ya disponibles y las migraciones que realmente hagan falta.
3. Registrar las decisiones sobre regreso al almacén, publicación, capacidad obligatoria, descarga por pedido y uso voluntario del GPS.
4. Establecer qué puede hacer el administrador y qué puede hacer el chofer.
5. Preparar un entorno y datos de prueba separados de los datos reales.

Propuesta inicial: mantener los estados existentes de Despacho y añadir información de publicación y revisión aprobada, si basta para distinguir el borrador interno del viaje disponible para el chofer. No usar en_ruta para representar que el administrador solamente publicó el viaje.

Entregables: inventario de adaptaciones, flujo aprobado y lista de contratos que se conservarán.

Criterio de cierre: se puede explicar sin ambigüedad quién publica, quién inicia y qué hecho confirma cada acción.

## Etapa 1 Completar coordenadas y verificar capacidad

Objetivo: disponer de datos adecuados antes de calcular rutas o autorizar cargas.

Trabajo

1. Verificar las coordenadas de cada almacén y sucursal que participará en el piloto. La dirección escrita no sustituye el punto de acceso al destino.
2. Permitir identificar claramente los destinos que todavía no tengan ubicación.
3. Comprobar en Django el peso real preparado frente a la capacidad declarada del vehículo.
4. Mantener toneladas en la interfaz y el contrato interno existente en kg, con conversión decimal exacta.
5. Mostrar Capacidad sin verificar cuando falten datos. La futura publicación se bloqueará si falta capacidad declarada o si la carga la supera, según la decisión confirmada en la etapa 0.
6. Considerar el acceso de los camiones al origen y a cada sucursal al revisar las rutas propuestas.

Entregables: datos del piloto verificados, validaciones de capacidad y mensajes claros.

Criterio de cierre: con un vehículo de 2 t y una carga medida de 1500 kg se verifica la comparación correcta; ninguna cantidad de cajas se convierte automáticamente a kg.

Si faltan coordenadas, el sistema podrá conservar el trabajo manual actual, pero no presentará como calculado un recorrido que no se obtuvo.

## Etapa 2 Preparar publicación autenticación y API del chofer

Objetivo: que un chofer pueda acceder a su trabajo sin obtener acceso general a Despachos.

Trabajo

1. Incorporar una autenticación adecuada para la aplicación móvil, conservando las sesiones de la web.
2. Proponer credenciales revocables por dispositivo, expiración y almacenamiento seguro.
3. Crear consultas de Mis despachos filtradas por el Usuario autenticado en el backend.
4. Exponer únicamente viajes publicados o autorizados para ese chofer, con su carga y el orden vigente de paradas.
5. Incorporar la acción administrativa de publicar y conservar su responsable, fecha y versión.
6. Adaptar los servicios de negocio para admitir las acciones del chofer asignado con permisos propios. No resolverlo concediéndole todos los permisos administrativos.
7. Conservar el prefijo /api/v1 y los contratos existentes; añadir rutas de negocio en español cuando corresponda.

El permiso actual para ser asignado como chofer no basta para operar el recorrido. Esa autorización se implementará expresamente en la API y en los servicios.

Entregables: acceso móvil, listado y detalle de viajes propios, publicación auditada y pruebas de permisos.

Criterio de cierre: dos choferes solo ven sus respectivos viajes; cambiar el identificador en una petición no permite consultar ni modificar el viaje ajeno.

## Etapa 3 Registrar la descarga de cada pedido

Objetivo: cumplir el flujo funcional anterior dentro de una única parada por sucursal.

Trabajo

1. Añadir el registro de descarga del pedido transportado en ese viaje, vinculado a sus cargas y preparaciones exactas.
2. Permitir comprobar los productos efectivamente descargados y conservar la copia de lo enviado.
3. Mantener la llegada como acción previa a la descarga.
4. Completar una parada cuando estén descargados todos los pedidos que le corresponden.
5. Definir la contabilización consolidada de cajillas por parada y color para que cada entrega física se registre una sola vez.
6. Conservar las restricciones de inventario, auditoría, transacciones y reintentos.

Reutilizar CargaDespacho como vínculo con las asignaciones preparadas. No crear simultáneamente varias relaciones pedido parada despacho que representen el mismo hecho sin una necesidad concreta.

Entregables: detalle de descarga por pedido y producto, integración con paradas y cajillas, y pruebas.

Criterio de cierre: una sucursal con dos pedidos permite confirmar cada uno, mantiene una sola parada y no duplica productos ni movimientos de cajillas al repetir una petición.

## Etapa 4 Crear la aplicación Android con el flujo manual

Objetivo: probar primero un viaje completo desde el celular.

Pantallas

- Inicio de sesión.
- Mis despachos con fecha, vehículo, estado y avance.
- Detalle del viaje y siguiente parada.
- Pedidos y productos de la parada.
- Registro de llegada y confirmación de descarga.
- Resumen y finalización del recorrido.

Trabajo

1. Crear el proyecto Expo y fijar versiones compatibles de sus dependencias.
2. Configurar navegación, sesión, cliente de API, manejo de errores y componentes comunes.
3. Mostrar una acción principal según el estado: Iniciar recorrido, Registrar llegada, Confirmar descarga o Finalizar recorrido.
4. Conservar las cantidades de la carga como información preparada; no recalcularlas ni modificarlas libremente desde el celular.
5. Preparar una compilación de desarrollo Android y probarla en un dispositivo real desde esta etapa.

Entregables: proyecto móvil y primer recorrido funcional con orden manual.

Criterio de cierre: un administrador envía un viaje al chofer; el chofer asignado lo consulta, registra salida, atiende las paradas y lo finaliza. El sistema web muestra las mismas operaciones.

Esta etapa puede probarse siempre conectada. La resistencia a cortes y cierre del proceso se completa en la etapa 8.

## Etapa 5 Mostrar mapas y recorridos por carretera

Objetivo: que el celular y el sistema administrativo presenten el mismo recorrido.

Trabajo

1. Seleccionar el proveedor de mapas y revisar claves, condiciones de uso y configuración de Android.
2. Integrar MapLibre Native en el celular y React Leaflet con MapLibre en Next.js, utilizando OpenFreeMap/OpenStreetMap, sin Google Maps SDK ni clave de facturación.
3. Integrar OSRM para consultar distancias, tiempos y geometría de los tramos.
4. Dibujar el almacén, todas las paradas y el recorrido aprobado sobre calles.
5. Conservar una versión del plan con orden, coordenadas utilizadas, geometría y métricas.
6. Permitir abrir una aplicación de navegación hacia la siguiente parada.

La visualización del recorrido y la navegación giro a giro son funciones diferentes. Abrir una aplicación externa no debe presentarse como garantía de seguir exactamente la geometría dibujada por HortyFru.

Esta etapa utiliza la API Route de OSRM para conservar el orden elegido y devolver el trazado completo por carretera, sus tramos y métricas, incluido el retorno. No incorpora tráfico en vivo ni optimización del orden. La API Table corresponde a la matriz de la etapa 6; esa matriz puede ser asimétrica y contener trayectos no disponibles. Ningún error se transforma silenciosamente en distancia cero o en una línea recta [3].

Entregables: mapas web y móvil con la misma versión del recorrido y tratamiento de errores.

Criterio de cierre: el orden y la geometría coinciden en ambas aplicaciones; faltas de coordenadas o errores de OSRM se comunican sin perder el despacho.

## Etapa 6 Calcular y evaluar la ruta propuesta

Objetivo: ordenar las paradas de un vehículo con carga previamente asignada.

Trabajo

1. Mantener el origen fijo e incluir en el costo del piloto el regreso al mismo almacén de salida, según la regla confirmada en la etapa 0.
2. Obtener una matriz completa para todas las paradas del despacho, aunque la interfaz las presente en varias páginas.
3. Reutilizar la matriz durante las generaciones del algoritmo genético.
4. Implementar con DEAP individuos como permutaciones válidas, cruces apropiados, mutación y elitismo.
5. Comparar orden manual, vecino más cercano, genético y OR-Tools con la misma matriz y las mismas condiciones.
6. Guardar semilla, parámetros, duración del cálculo, métricas y resultados de varias ejecuciones.
7. Ejecutar el trabajo fuera de la vista HTTP cuando sea necesario y permitir consultar Calculando, Lista, Error u Obsoleta.
8. Permitir al chofer revisar la propuesta y confirmar la versión de su recorrido antes de salir.

El algoritmo reorganiza paradas; no redistribuye pedidos entre camiones ni cambia el contenido de la carga. Miraflores con tres pedidos representa un solo destino del algoritmo.

No se prometerá el óptimo global ni una mejora en todos los casos. OR-Tools también utiliza estrategias que pueden producir soluciones no óptimas [4]. Para una evaluación académica, registrar tanto las mejoras como los casos en que el método no supera las referencias.

Si cambian los datos de entrada, la propuesta debe revisarse de nuevo. En un viaje iniciado, una futura replanificación solo considerará lo pendiente y conservará las operaciones ya realizadas.

Entregables: servicio de optimización, comparación reproducible y revisión de rutas.

Criterio de cierre: todos los destinos aparecen exactamente una vez; las métricas son reproducibles con el mismo contexto y la ruta aprobada se conserva en PostgreSQL.

## Etapa 7 Compartir ubicación durante el viaje

Objetivo: capturar ubicaciones autorizadas y asociarlas al despacho correcto.

Trabajo

1. Separar Iniciar recorrido de Compartir ubicación.
2. Crear una sesión de seguimiento vinculada al viaje, chofer y dispositivo.
3. Capturar coordenadas, precisión, hora original y, cuando estén disponibles, velocidad y rumbo.
4. Enviar lotes de posiciones a la API con identificadores únicos.
5. Conservar hora de captura y hora de recepción.
6. Aplicar límites razonables de frecuencia y controles de calidad.
7. Detener la captura local al finalizar el seguimiento o el viaje.

Solo el chofer asignado con una sesión autorizada podrá enviar posiciones. El administrador no activará a distancia el GPS simplemente por abrir un mapa.

Una ubicación tardía puede formar parte del historial según la política establecida, pero no debe reemplazar una posición más reciente ni reactivar una sesión terminada.

Entregables: API de sesiones y posiciones, captura inicial y pruebas con dos cuentas.

Criterio de cierre: el viaje correcto recibe las posiciones y una cuenta ajena no puede enviarlas; repetir un lote no duplica los puntos.

## Etapa 8 Conservar operaciones sin conexión y seguir en segundo plano

Objetivo: resistir cortes de señal y utilizar las capacidades permitidas por Android.

Trabajo

1. Incorporar SQLite para los viajes descargados, rutas, posiciones pendientes y cola de operaciones.
2. Guardar cada operación antes de enviarla y mantener su identificador hasta recibir confirmación.
3. Sincronizar en orden las acciones que dependan entre sí, como llegada, descarga y cierre.
4. Mostrar Pendiente de sincronizar hasta que Django confirme la operación.
5. Resolver conflictos de versión y autorización sin sobrescribir silenciosamente el estado del servidor.
6. Separar los datos y colas de cada cuenta. Tratar los pendientes antes de cambiar de usuario o cerrar sesión.
7. Configurar permisos y servicio de ubicación en segundo plano con una notificación visible cuando corresponda.
8. Probar pantalla bloqueada, pérdida de Internet, recuperación de señal y reapertura de la aplicación.

Expo exige una compilación adecuada para probar estas funciones de Android; Expo Go no cubre los servicios necesarios. El seguimiento está sujeto a restricciones del sistema y puede detenerse si se termina la aplicación [5].

Guardar una ruta y sus puntos no equivale a disponer de todos los mapas sin conexión. Si se necesita cartografía completa offline, será un alcance adicional que dependerá del proveedor y sus condiciones.

Entregables: cola persistente, sincronización con reintentos y seguimiento en segundo plano probado.

Criterio de cierre: un corte de señal y un reinicio no hacen perder operaciones pendientes; al reconectar se registran una sola vez. El cierre local detiene la captura GPS aunque el cierre del viaje siga pendiente de confirmación en Django.

## Etapa 9 Supervisar al chofer desde Next.js

Objetivo: consultar ubicación y avance con estados fiables.

Trabajo

1. Incorporar Django Channels, servidor ASGI y Redis para distribuir actualizaciones.
2. Persistir primero los datos y emitir avisos después de confirmar la transacción.
3. Autorizar el acceso WebSocket a los viajes que el administrador puede supervisar.
4. Mostrar ubicación, precisión y hora de la última medición, además del estado de conexión.
5. Mostrar la siguiente parada y las descargas confirmadas.
6. Al reconectar el navegador, consultar el estado vigente y continuar con los eventos en vivo.
7. Mantener la llegada, descarga y finalización como acciones independientes de la posición GPS.

Channels documenta channels_redis como su capa oficial mantenida para producción [6]. Redis distribuye mensajes; PostgreSQL conserva la información oficial.

Entregables: mapa administrativo con seguimiento autorizado y avance de paradas.

Criterio de cierre: las ubicaciones del celular aparecen en el viaje correspondiente; una señal antigua se identifica como desactualizada y un punto tardío no hace retroceder la posición actual.

## Etapa 10 Generar el APK y completar las pruebas de campo

Objetivo: entregar una aplicación Android instalable y un despliegue que permita usarla fuera de la oficina.

Trabajo

1. Configurar entornos de desarrollo, pruebas y producción.
2. Preparar la API pública con HTTPS y los canales de seguimiento con WSS.
3. Configurar firma Android y custodiar las credenciales para futuras actualizaciones.
4. Generar el APK de distribución que no dependa de Expo Go ni de Metro.
5. Probar una actualización sin perder datos locales pendientes.
6. Revisar funcionamiento con la app bloqueada, permisos retirados, conexión intermitente y cierre del proceso.
7. Preparar el manual de uso y el procedimiento de actualización y respaldo.

El APK es el archivo instalable directamente en Android. El AAB se prepara si se decide distribuir por Google Play [7]. La compilación y distribución requieren configurar las cuentas y credenciales elegidas.

Para una demostración local, el celular puede acceder a Django mediante la red del equipo de desarrollo. Para un reparto fuera de esa red, el backend deberá ser accesible por Internet. La dirección localhost del teléfono no representa la computadora.

Entregables: APK firmado, código fuente, configuración de compilación, guía de instalación y operación.

Criterio de cierre: un Android compatible instala el archivo final, inicia sesión y completa un viaje de prueba contra el entorno previsto.

## Etapa 11 Conciliar los pesos en Entregas

Implementación web disponible en `/entregas`, con recepción por sucursal y revisión
de oficina. Ver [flujo y permisos de Entregas](entregas_recepcion_sucursales.md).
La prueba visual y física continúa siendo manual.

Objetivo: completar la revisión comercial posterior a la descarga física.

Trabajo

1. Registrar lo comunicado por la sucursal: cantidades, pesos recibidos, responsable y comprobante cuando corresponda.
2. Conciliar lo aceptado y rechazado con las preparaciones y aportes de lotes realmente enviados.
3. Admitir revisión en borrador y confirmación con permisos separados.
4. Conservar la descarga original y el historial del viaje.
5. No generar una segunda salida de productos.

Entregables: módulo de Entregas conectado con las descargas.

Criterio de cierre: un viaje puede estar finalizado y sus pesos revisarse después, siempre que exista la descarga correspondiente. El stock no se descuenta de nuevo.

Las incidencias informativas pueden añadirse como una etapa posterior. Las devoluciones de carga, entregas fallidas y replanificaciones automáticas requieren reglas adicionales; no se incorporarán por suposición al flujo normal que ya definiste.

## 6 Hitos para revisar el avance

- Hito A después de la etapa 4: administrador y chofer completan el mismo viaje con orden manual.
- Hito B después de la etapa 5: ambas aplicaciones muestran la misma ruta sobre calles.
- Hito C después de la etapa 6: se puede comparar y explicar la ruta propuesta por el genético.
- Hito D después de la etapa 9: el administrador sigue el viaje y se recuperan cortes de conexión.
- Hito E después de la etapa 10: se entrega y valida el APK firmado.
- Hito F después de la etapa 11: oficina concilia pesos sin modificar el inventario por segunda vez.

## 7 Pruebas mínimas antes de considerar completo el módulo

Acceso y operación

- Dos choferes no consultan ni modifican viajes ajenos.
- Un viaje publicado no aparece como iniciado hasta registrar la salida real.
- Un mismo vehículo y chofer no tienen dos viajes en ruta simultáneamente.
- Dos pedidos de una sucursal conservan una parada y sus descargas individuales.
- Las confirmaciones repetidas no duplican cajillas ni operaciones.
- Una atención parcial conserva exactamente sus asignaciones y lotes.

Rutas y capacidad

- La comparación de toneladas y kg es exacta y no usa equivalencias de cajas.
- Todos los destinos del despacho participan aunque haya más de 10.
- La ruta contiene cada parada una sola vez y respeta la regla de retorno.
- Una coordenada faltante o un trayecto no disponible no se convierte en una ruta ficticia.
- Cambiar datos invalida la aprobación anterior cuando corresponde.

GPS y sincronización

- El seguimiento comienza con autorización y se detiene al cerrar la sesión o el viaje.
- Las posiciones tienen identidad y no se duplican al reenviarlas.
- Una posición antigua no se muestra como la más reciente.
- Llegada, descarga y cierre pendientes conservan su orden.
- Los datos pendientes sobreviven a reinicios y no se mezclan entre usuarios.
- Se distingue entre sin señal, GPS desactivado, permiso denegado y ubicación desactualizada.

Entrega y despliegue

- El APK final funciona sin el servidor de desarrollo móvil.
- El backend es accesible desde el entorno donde trabajará el chofer.
- La actualización conserva pendientes y se conocen las credenciales de firma.
- Las descargas y la conciliación posterior no vuelven a descontar productos.

## 8 Por dónde comenzaría

Comenzaría con la etapa 0 y después con las adaptaciones de publicación, permisos y descarga por pedido. El primer resultado que buscaría es un viaje manual completo entre el administrador y un Android real.

Esto permite comprobar la operación y sus permisos antes de añadir complejidad al cálculo de rutas y al seguimiento. PostgreSQL se conserva desde el primer día; SQLite se incorpora como apoyo local para las pruebas de conectividad.

El plan define qué desarrollar y cómo verificarlo. No representa que las funciones nuevas de móvil, GPS u optimización ya estén implementadas.

## 9 Referencias

Fuentes del proyecto revisadas

- Documento funcional completo de HortyFru proporcionado por el usuario, especialmente F12 a F16.
- Documento nuevo de choferes GPS y optimización de rutas proporcionado por el usuario.
- Código existente de despachos, vehiculos, preparaciones, cajillas, usuarios, clientes y almacenes.
- Configuración actual de autenticación, permisos y base de datos del backend.

Documentación oficial consultada

[1] Expo SQLite
https://docs.expo.dev/versions/latest/sdk/sqlite/

[2] Expo Router y organización de rutas
https://docs.expo.dev/router/basics/core-concepts/

[3] OSRM API
https://project-osrm.org/docs/v5.24.0/api/

[4] OR Tools y problema del viajante
https://developers.google.com/optimization/routing/tsp

[5] Expo Location
https://docs.expo.dev/versions/latest/sdk/location/

[6] Django Channels y capas de comunicación
https://channels.readthedocs.io/en/latest/topics/channel_layers.html

[7] Expo y archivos APK
https://docs.expo.dev/build-reference/apk/
