# Etapa cero de la aplicación móvil de HortyFru

Fecha de revisión 30 de octubre de 2026

Estado revisión técnica completada y reglas del piloto confirmadas

## 1 Resultado de la revisión

La base existente permite continuar con el proyecto móvil sin rehacer Despachos. Se revisaron los modelos, permisos, servicios, contratos de API y pruebas de Despachos, Preparaciones, Cajillas, Vehículos y sus dependencias.

Se preparó una configuración optativa de pruebas en PostgreSQL separada de la base habitual. Pasaron 438 pruebas de backend y 143 de frontend. La compilación de Next.js, TypeScript y la revisión de ESLint de los módulos operativos terminaron correctamente.

En esta etapa no se implementaron publicación de viajes, nuevos permisos del chofer, mapas, GPS, optimización ni descarga por pedido. Esas adaptaciones están identificadas y ordenadas para las siguientes etapas.

## 2 Reglas confirmadas para el piloto

Estas dos decisiones fueron confirmadas por el usuario durante esta revisión.

1. El recorrido incluye el regreso al mismo almacén de salida.
2. La futura publicación de un despacho se bloquea si el vehículo no tiene capacidad declarada o si el peso preparado supera esa capacidad.

La comprobación de capacidad se realizará en el backend. Se volverá a validar antes de iniciar el viaje para detectar cambios posteriores a la publicación. Las mediciones incompletas no deben considerarse automáticamente como peso cero ni como capacidad verificada.

Se mantienen las decisiones anteriores: PostgreSQL como almacenamiento principal, chofer vinculado a Usuarios, GPS voluntario, operaciones manuales de llegada y descarga, y conciliación de pesos posterior en Entregas.

Las reglas nuevas quedan documentadas para implementarse en sus etapas. Todavía no cambian el comportamiento de los despachos existentes.

## 3 Situación de los datos actuales

La consulta a la base habitual se ejecutó dentro de una transacción PostgreSQL marcada como solo lectura. Se obtuvieron únicamente cantidades agregadas, permisos del rol y estado de migraciones; no se copiaron datos personales.

| Comprobación | Resultado observado |
| --- | --- |
| Almacenes activos | 1 |
| Almacenes activos sin coordenadas | 1 |
| Sucursales activas de clientes activos | 2 |
| Sucursales anteriores sin coordenadas | 2 |
| Vehículos activos | 1 |
| Vehículos activos sin capacidad declarada | 0 |
| Despachos en ruta | 1 |
| Despachos finalizados | 1 |
| Despachos en borrador o cancelados | 0 |
| Migraciones pendientes en la base habitual | Ninguna |
| Permiso del rol Chofer de despachos | conducir_despacho |

Estos valores describen el momento de la revisión y pueden cambiar por el uso normal del sistema. Los viajes en ruta y los históricos requieren compatibilidad cuando se introduzca la publicación.

Hallazgo para la etapa 1: ya existen los campos de coordenadas, pero faltan las ubicaciones de un almacén y dos sucursales. No se inventaron ni se rellenaron coordenadas.

## 4 Inventario de lo que se conserva

| Área | Implementación comprobada | Consecuencia para el proyecto móvil |
| --- | --- | --- |
| Despacho | Almacén, vehículo, Usuario chofer, fecha de reparto y cuatro estados | Reutilizar la cabecera y sus estados |
| ParadaDespacho | Una sucursal por parada, orden y fechas de llegada y descarga | Mantener la parada consolidada por destino |
| CargaDespacho | Vínculo con la asignación preparada y copia JSON de su contenido | Conservar pedidos, preparaciones, productos y aportes exactos |
| CajillaDespacho | Cantidad entera por parada y color | Confirmar cada entrega física una sola vez |
| OperacionDespacho | Acción, cuenta, clave única, huella y fecha | Conservar reintentos idempotentes y trazabilidad |
| Preparaciones | Atención parcial y aportes físicos por lote | Enviar solo lo preparado; no fusionar CANT y UNI |
| Inventario | Salida al confirmar Preparaciones | No generar otra salida al iniciar ni descargar |
| Cajillas | Movimientos de carga y entrega vinculados al viaje | Mantener almacén, tránsito y pendiente de sucursal |
| Vehículos | Capacidad opcional en kg y conversión exacta a toneladas en la interfaz | Añadir control de publicación sin hacer obligatorio el catálogo completo |
| Almacenes y sucursales | Coordenadas opcionales, parejas completas y rangos validados | Completar puntos reales antes de optimizar |
| Autenticación | Sesiones de Django para la web | Incorporar acceso móvil sin sustituir la sesión web |
| Auditoría | Middleware HTTP y servicio central dentro de transacciones | Reutilizar ambos mecanismos y registrar los procesos fuera de HTTP |

La evidencia técnica adjunta enumera 14 modelos, 54 patrones de ruta de los módulos revisados y las huellas de 25 archivos fuente. Los patrones de ruta incluyen variantes técnicas del router; no representan 54 funciones nuevas.

## 5 Adaptaciones necesarias y etapa correspondiente

| Identificador | Adaptación | Estado actual | Etapa prevista |
| --- | --- | --- | --- |
| A01 | Completar coordenadas del origen y destinos | Campos disponibles; datos pendientes | 1 |
| A02 | Comprobar capacidad también en Django | La interfaz muestra una advertencia; no hay control de exceso en iniciar_viaje | 1 y validación al publicar en 2 |
| A03 | Publicar sin registrar salida real | No existe una acción ni datos de publicación | 2 |
| A04 | Consultar y operar viajes propios del chofer | Los servicios exigen permisos administrativos de Despachos | 2 |
| A05 | Autenticación móvil por dispositivo | Solo sesión web en la configuración habitual | 2 |
| A06 | Descargar pedidos y productos dentro de una parada | La descarga actual confirma toda la parada | 3 |
| A07 | Compatibilidad de viajes anteriores | Hay viajes en ruta y finalizados | 2 y 3 |
| A08 | Aplicación Android y navegación | No hay proyecto móvil implementado | 4 |
| A09 | Plan de ruta con geometría y versiones | Orden manual de paradas disponible | 5 |
| A10 | Algoritmo genético y comparaciones | No implementados | 6 |
| A11 | Sesiones y puntos GPS | No implementados | 7 |
| A12 | SQLite y sincronización persistente | No implementadas | 8 |
| A13 | Canales de seguimiento y Redis | ASGI básico de Django, sin Channels instalado | 9 |
| A14 | Conciliación de pesos en Entregas | Fuera del flujo actual de descarga de Despachos | 11 |

No se instalaron bibliotecas, modificaron roles existentes ni crearon modelos o migraciones de estas funciones durante la etapa 0.

## 6 Flujo operativo definido

1. El personal de Preparaciones confirma la carga, sus aportes de lotes y las mediciones reales. Se descuenta inventario una sola vez.
2. El administrador de Despachos selecciona esa carga y asigna vehículo y chofer.
3. Revisa el recorrido, las cajillas, la capacidad y el regreso al almacén.
4. Publica la revisión válida para el chofer. Publicar mantiene el viaje pendiente de salida.
5. El chofer asignado consulta su viaje publicado e inicia el recorrido cuando sale físicamente.
6. Si decide compartir ubicación y concede los permisos, comienza una sesión GPS del viaje.
7. En cada sucursal registra llegada, revisa los pedidos transportados y confirma sus descargas.
8. La parada se completa cuando se descargan sus pedidos y se contabilizan las cajillas correspondientes una sola vez.
9. El chofer registra el retorno y finaliza el viaje una vez completadas las descargas. La captura GPS se detiene.
10. Oficina concilia posteriormente en Entregas los pesos aceptados y rechazados.

La cercanía GPS no confirma llegadas, descargas ni cierres. Los controles de permisos se aplican en el backend y no solo en los botones de las pantallas.

## 7 Matriz de responsabilidades y permisos

Los permisos futuros de la tabla son responsabilidades definidas, no permisos ya creados.

| Operación | Administrador autorizado | Chofer asignado | Oficina de Entregas |
| --- | --- | --- | --- |
| Crear y editar carga del viaje | Según permisos actuales separados | No | No |
| Asignar vehículo y chofer | Según permisos administrativos | No | No |
| Aprobar ruta y publicar | Permiso futuro específico | Consultar la versión publicada | No |
| Iniciar salida física | Personal autorizado como respaldo | Su propio viaje autorizado | No |
| Llegar y confirmar descarga | Personal autorizado como respaldo | Su propio viaje y parada siguiente | Consultar respaldo |
| Compartir GPS del dispositivo | Supervisar si tiene permiso | Activación voluntaria de su sesión | No por defecto |
| Finalizar y registrar retorno | Personal autorizado | Su propio viaje con descargas completas | No |
| Conciliar pesos comerciales | Solo con permiso de Entregas | No equivale a descargar | Según permisos separados |

Conducir un vehículo, consultar viajes propios y operar el recorrido deben distinguirse. El permiso conducir_despacho actual solo habilita la asignación; no se ampliará el rol del chofer con todos los permisos administrativos.

La futura política del servicio admitirá al administrador autorizado o al chofer asignado con su permiso propio. No se duplicarán servicios de negocio para el celular ni se eliminarán los permisos separados de crear, editar, iniciar y finalizar.

## 8 Contratos que se conservan

### Escritura y estados

Los endpoints actuales de Despachos mantienen el prefijo /api/v1/despachos/.

La escritura del borrador recibe almacen, vehiculo, chofer, fecha_reparto, observaciones, asignaciones, orden_sucursales y cajillas. Crear utiliza clave_operacion y editar exige version. Las acciones utilizan version y clave_operacion; llegada y descarga actuales reciben parada.

Se conservan borrador, en_ruta, finalizado y cancelado. Solo el borrador se edita o cancela. Iniciar registra salida_en; finalizar registra retorno_en y requiere completar las paradas.

Los datos de publicación se introducirán de manera compatible y sin utilizar en_ruta para indicar que el documento solamente está disponible.

### Carga y cantidades

Cada asignación preparada se incluye completa con sus aportes. Varias asignaciones pueden pertenecer al mismo pedido y producto, y una misma cantidad atendida puede utilizar varios lotes.

No se añadirá una restricción global que impida enviar partes de un pedido en viajes diferentes cuando el flujo actual permita atenderlo parcialmente. La carga concreta de ese pedido en ese viaje será la referencia de la descarga.

Se mantienen 1000 asignaciones como límite actual del documento y páginas de 10 en los listados. Cambiar un filtro conserva lo elegido. Los cálculos futuros de capacidad y optimización usarán todas las filas.

### Inventario y cajillas

Un borrador de despacho no mueve productos ni cajillas. Iniciar registra carga de cajillas hacia tránsito; descargar registra su entrega a la sucursal. Cancelar un borrador libera la carga preparada para otro viaje y conserva el historial.

Las devoluciones y operaciones manuales existentes conservan sus contratos. No se introducen nuevos retornos de carga ni entregas fallidas en el alcance del piloto.

### Versiones y auditoría

Se conservan la versión del documento, claves de operación, huellas, bloqueo transaccional, exclusividad de carga y exclusividad de vehículo y chofer en ruta. Una caída de auditoría de negocio debe revertir la operación.

La publicación y los futuros eventos del dispositivo utilizarán esta misma disciplina. La sincronización del celular no podrá sobrescribir cambios nuevos del servidor sin resolver el conflicto.

## 9 Cambios de datos y migraciones previstas

Durante la etapa 0 no se necesitó ninguna migración. La verificación del modelo tampoco detectó migraciones faltantes.

Propuestas para etapas posteriores

- Etapa 1: las coordenadas y la capacidad ya tienen campos. Se necesitan datos y validaciones; no una tabla equivalente nueva.
- Etapa 2: añadir publicación, responsable y referencia de la revisión aprobada de manera compatible. Editar el contenido debe invalidar su aprobación según la regla que se implemente.
- Etapa 3: registrar la descarga del pedido en el viaje y su detalle vinculado a CargaDespacho o a las asignaciones correspondientes. Mantener el agregado de parada para el recorrido.
- Etapa 5: incorporar el plan versionado con origen, retorno, coordenadas utilizadas, orden, geometría y métricas.
- Etapa 7: incorporar sesiones de seguimiento y puntos con identidad, precisión, hora de captura y recepción.

Los viajes actuales en ruta y finalizados deben seguir siendo consultables aunque no tengan publicación registrada. No se fabricarán fechas históricas de publicación ni marcas individuales de productos que antes no se guardaban.

No se borrarán ni migrarán los datos actuales hacia otro módulo para reproducir los nombres del documento anterior. Sus nombres y tablas describen una referencia funcional; la implementación vigente de Django es la base que se adapta.

## 10 Entorno de pruebas separado

Se creó Backend/config/pruebas_aisladas.py. Es una configuración optativa que no se importa desde el servidor habitual.

Medidas verificadas

- La conexión normal y TEST.NAME del perfil apuntan a pruebas_hortyfru_movil.
- El nombre debe comenzar por pruebas_, usar caracteres permitidos y tener como máximo 63 caracteres.
- Se rechaza la coincidencia con el nombre de la base habitual.
- La configuración rechaza alias adicionales hasta revisar su aislamiento.
- Las copias de archivos de prueba se dirigen a una carpeta temporal separada de media real.
- El correo utiliza memoria y la caché es local al proceso.
- Se mantuvieron el motor PostgreSQL, las migraciones y las restricciones reales del sistema.

La base se preparó al ejecutar las pruebas y se conservó con --keepdb. Después de la suite quedaron cero usuarios, pedidos, preparaciones, despachos, lotes y movimientos de inventario de prueba. Las fixtures se crean durante las pruebas y se revierten o limpian al terminar.

Este entorno es para pruebas automáticas. No es un piloto manual permanente ni contiene cuentas para iniciar sesión desde el navegador. Un entorno de demostración persistente se preparará por separado antes de las pruebas móviles, para evitar que una ejecución de tests vacíe esos datos.

### Cómo repetir la verificación

Desde la carpeta Backend

    .venv/Scripts/python.exe manage.py check --settings=config.pruebas_aisladas

    .venv/Scripts/python.exe manage.py test usuarios roles auditoria catalogos productos clientes pedidos proveedores compras almacenes inventario recepciones cajillas preparaciones vehiculos despachos --settings=config.pruebas_aisladas --keepdb --noinput

    .venv/Scripts/python.exe manage.py makemigrations --check --dry-run --settings=config.pruebas_aisladas

Desde la carpeta Frontend con PowerShell

    node --test (rg --files pruebas -g '*.mjs')

    npm.cmd run build

    npx.cmd --no-install eslint src/components/despachos src/components/preparaciones src/components/cajillas src/components/vehiculos

HORTYFRU_BD_PRUEBAS permite elegir otro nombre que cumpla las restricciones. No se editó .env ni se cambió la configuración habitual del servidor.

## 11 Datos sintéticos reproducibles

Se reutilizaron las fábricas de datos de las suites existentes, especialmente DatosPreparaciones y DatosDespachos.

La base de Despachos de esas pruebas construye un cliente con dos sucursales, pedidos con CANT y UNI independientes, un lote recibido de 200 kg y una preparación confirmada que utiliza 50 kg. Esa preparación atiende 2 cajas para una sucursal con 20 kg y 3 cajas para la otra con 30 kg. También prepara un color de cajilla y un vehículo para comprobar el ciclo de carga y entrega.

Otros casos agregan varios pedidos, fechas diferentes, más de 10 grupos, varios lotes, permisos limitados y operaciones concurrentes. Son datos sintéticos de pruebas, no registros que se hayan añadido a la base habitual.

Los casos de acceso móvil de dos choferes se añadirán cuando exista esa API. La suite actual verifica la autorización administrativa y que un usuario sin habilitación no pueda asignarse como chofer; no se presenta como prueba de una API móvil todavía inexistente.

## 12 Resultados de verificación

| Comprobación ejecutada | Resultado |
| --- | --- |
| Django check con configuración aislada | Correcto |
| Suite backend de los 16 módulos indicados | 438 pruebas correctas |
| Suite frontend | 143 pruebas correctas |
| Compilación de producción de Next.js y TypeScript | Correcta |
| ESLint en Despachos Preparaciones Cajillas y Vehículos | Correcto |
| Detección de migraciones faltantes | No se detectaron cambios |
| Nombres inválidos o demasiado largos para pruebas | Rechazados |
| Nombre válido de base aislada | Aceptado |
| Conexión PostgreSQL de las pruebas | pruebas_hortyfru_movil verificada |
| Datos de negocio sintéticos tras finalizar | Sin registros residuales en las tablas comprobadas |

La suite cubre exclusividad de carga, vehículo y chofer, reintentos, versiones, permisos, concurrencia, conservación del inventario, tránsito de cajillas y reversión ante fallos de auditoría.

No se automatizó el escritorio ni el navegador. Los controles del frontend se ejecutaron mediante las pruebas disponibles y compilación. No se afirma que se hayan probado GPS ni teléfonos en esta etapa.

## 13 Cierre y siguiente paso

La etapa 0 queda cerrada con inventario de adaptaciones, contratos conservados, responsabilidades, flujo del piloto, reglas confirmadas y verificación reproducible en una base separada.

La siguiente es la etapa 1. El trabajo concreto identificado es verificar y completar la ubicación real de un almacén y dos sucursales y añadir la validación de capacidad en el backend conforme a la regla confirmada.

Esta revisión no inició la etapa 1 ni alteró los viajes existentes.

Archivos de respaldo

- plan_aplicacion_movil_rutas_gps.md contiene el plan general y el estado actualizado.
- etapa_cero_movil.json conserva el inventario técnico y resultados agregados.
- Backend/config/pruebas_aisladas.py contiene el perfil de pruebas optativo.
