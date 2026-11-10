# Asignación en web y recorrido en el celular

3 de noviembre de 2026. Este flujo sustituye la planificación administrativa de la etapa 5.

**Actualización:** el chofer también dispone de **Mis viajes** (`/mis-viajes`) en
el navegador del teléfono, con mapa amplio y GPS autorizado en primer plano sobre
HTTPS. El [procedimiento web](adaptacion_chofer_web.md) describe el flujo vigente de
esta alternativa. Android permanece conservado hasta su validación física; los
comandos y referencias al APK de este informe documentan el flujo anterior.

La administración alista y envía la carga. El chofer prepara y ejecuta su recorrido. La web consulta las entregas.

| Web: Despachos | Aplicación del chofer |
| --- | --- |
| Elegir pedidos y carga preparada confirmada. | Consultar el viaje recibido y su carga. |
| Asignar vehículo, chofer y cajillas por destino. | Ordenar las paradas y calcular el recorrido. |
| Revisar capacidad y enviar. | Revisar el mapa y pulsar **Usar recorrido**. |
| Editar borradores sin enviar o cancelar antes de salir. | Iniciar, registrar llegadas y confirmar descargas por pedido. |
| Consultar el avance y el mapa del chofer. | Confirmar el retorno y finalizar. |

## Prueba del flujo

1. En la web, continuar el borrador o crear un despacho. Los pasos son **Carga → Transporte → Revisión**. Las cajillas de Preparaciones aparecen automáticamente por sucursal/color; **Ajustar** permite corregir cantidades y **Usar previstas** restaura la previsión. Enviar al chofer cuando la carga esté revisada.
2. En el celular, actualizar Mis despachos, abrir el viaje y pulsar **Preparar recorrido**.
3. Expandir la tarjeta inferior para ver las paradas. Las flechas permiten elegir su orden; si hay más de diez, se conservan todas al cambiar de página.
4. Pulsar **Optimizar recorrido**. El genético usa la matriz de OSRM y dibuja la propuesta al terminar. Se puede cancelar el cálculo; al ajustar las flechas, **Calcular este orden** conserva la alternativa manual. La propuesta todavía no cambia el orden operativo.
5. Revisar calles y accesos. Pulsar **Usar recorrido** para confirmar el orden. El trazado queda listo para salir.
6. Pulsar **Iniciar viaje** desde el mapa, o iniciar desde la pantalla del viaje. Al salir, la versión confirmada queda fijada.
7. Abrir **Ver entregas**. Registrar llegada a la siguiente sucursal y confirmar cada pedido. La última descarga completa la parada y entrega las cajillas una sola vez.
8. Completar las paradas, regresar al mismo almacén y finalizar. La web muestra el seguimiento.

Para cargar los cambios del celular se utiliza el APK de desarrollo existente con Metro; esta modificación no incorpora bibliotecas nativas ni permisos nuevos:

```bash
cd /c/Proyectos/Universidad/hortyfru/Movil
npm start -- --lan --clear
```

Actualizar también la web y Django si no están usando recarga de desarrollo. Los comandos de arranque de OSRM, Django y Next.js están en [Etapa 5](etapa_cinco_movil.md).

## Reglas conservadas

- Solo el chofer asignado, con permiso de operar sus viajes y sesión móvil vigente, puede preparar la ruta mediante la API móvil. Una cuenta de consulta solo puede leer.
- Calcular no cambia pedidos, carga, inventario ni cajillas. Confirmar modifica únicamente el orden de las paradas existentes y registra responsable, fecha y auditoría.
- La operación exige el conjunto completo de paradas, sin duplicados ni destinos ajenos. Incluye regreso al mismo almacén.
- Las llamadas a OSRM no mantienen bloqueos de negocio. Al guardar se revalidan permiso, alcance, versión y ubicaciones.
- Un plan pendiente u obsoleto debe confirmarse o recalcularse antes de salir. Si no existe un plan, se conserva la operación manual para ubicaciones pendientes o errores del motor.
- Los planes históricos fijados se conservan con sus coordenadas y geometría. Los viajes iniciados no se reordenan ni recalculan en esta etapa.
- Enviar no registra salida ni mueve existencias. Iniciar valida nuevamente capacidad y cajillas. La descarga por pedido y el cierre conservan las reglas anteriores.
- Cada previsión de cajillas se cuenta una sola vez entre los pedidos elegidos del producto y la sucursal. No se infiere desde CANT/UNI. Los ajustes manuales persisten al reabrir y los viajes ya enviados conservan sus cantidades. Los borradores antiguos vacíos recuperan la previsión sin escribir durante la consulta; se guarda o materializa al enviar.
- Un resultado incierto mantiene UUID y cuerpo; bloquea otras escrituras de ese viaje hasta comprobarlo. Cambiar de cuenta limpia el estado y descarta respuestas anteriores.
- Las API administrativas anteriores siguen disponibles por compatibilidad con sus permisos; Despachos administrativo ofrece enviar, cancelar y seguimiento. La sección web Mis viajes incorpora las acciones propias del chofer, sin concederle permisos administrativos.

## API móvil de rutas

Rutas relativas a `/api/v1/movil/mis-despachos/{id}/`:

| Método y ruta | Datos |
| --- | --- |
| `GET ruta/` | Devuelve puntos, plan, versión, estado y acciones autorizadas. |
| `POST calcular-ruta/` | `version`, `clave_operacion`, `orden_paradas` completo. |
| `POST aprobar-ruta/` | `version`, `clave_operacion`, `plan`. |

La carga y el transporte quedan bloqueados tras el envío. El chofer modifica el orden del recorrido, con IDs de parada estables. OSRM conserva un perfil estático, sin tráfico en vivo ni certificación de restricciones particulares de camiones. La [etapa 6](etapa_seis_movil.md) añade optimización con DEAP y trabajador Docker.

## Compartir ubicación: etapa 7

Con el APK de desarrollo 0.3.0 y un viaje iniciado, Compartir ubicación solicita
consentimiento y permiso. El camión representa una medición GPS real y el área
su precisión; Centrar mi ubicación permite encuadrarlo. La captura se detiene
al dejar de compartir, pasar a segundo plano, intentar finalizar o cerrar sesión.
Volver a la app no la reactiva automáticamente. Ante una respuesta incierta se
puede comprobar el envío y cierre, conservando el cuerpo de la operación.
La [etapa 7](etapa_siete_movil.md) detalla pruebas y límites; la persistencia offline
y el segundo plano corresponden a la etapa 8 y la supervisión web en vivo a la 9.

## Comprobaciones

Las etapas 6 y 7 se verificaron en PostgreSQL aislado. La etapa 7 pasó la suite de 559 pruebas de backend, seguida por sus 15 pruebas específicas con concurrencia, y 49 pruebas móviles. Se comprueban autorización propia, permisos revocados, reintentos, más de diez paradas, auditoría, planes históricos, detención de GPS y operaciones del reparto. Los informes de cada etapa conservan el detalle y los límites de las pruebas.

La validación visual y física en el teléfono sigue siendo manual; no se automatizó el escritorio ni el dispositivo. No se crearon, enviaron ni iniciaron operaciones en la base habitual durante estas comprobaciones.
