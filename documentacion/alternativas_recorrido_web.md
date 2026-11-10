# Caminos alternativos del chofer

El chofer puede comparar caminos **antes de iniciar un viaje enviado**, después
de calcular u optimizar su recorrido. El algoritmo genético sigue eligiendo el
orden de las sucursales; esta comparación permite elegir las calles de un tramo
sin cambiar ese orden. Los tiempos siguen siendo estimaciones de OSRM para
automóvil, sin tráfico en vivo ni tiempo de descarga.

## Uso

1. Entrar en **Mis viajes**, abrir un viaje pendiente de salida y elegir
   **Ver viaje → Recorrido**. Si todavía no hay un trazado calculado, calcularlo
   u optimizarlo primero.
2. Abrir **Comparar caminos por tramo** y elegir el origen y destino. También
   está incluido el regreso al mismo almacén. Los tramos se paginan de diez.
3. Comparar distancia, tiempo estimado y calles principales. **Ver en mapa**
   muestra los caminos sobre el mapa principal: la selección conserva el color
   del tramo y las otras opciones aparecen en gris. La tarjeta permite pasar
   de una opción a otra sin guardar cambios.
4. Pulsar **Elegir este camino**, revisar el total actualizado y confirmar
   **Usar recorrido** antes de iniciar el viaje.

Se muestran el camino actual y hasta dos caminos distintos si OSRM los
encuentra. No se garantiza que haya otra opción. Cuando solo existe el actual,
se explica en pantalla y se conserva. Una comparación vence a los diez minutos;
puede consultarse nuevamente. Cerrar la comparación no modifica el recorrido.
Una elección guardada crea una nueva propuesta pendiente de confirmación.

Un viaje ya iniciado conserva su recorrido fijado. Para probar la función se
necesita uno pendiente de salida; los viajes actuales en ruta no se alteran.

## Servicio y reglas

- `POST /api/v1/chofer/mis-viajes/{id}/consultar-alternativas/` recibe versión,
  UUID, plan y número de tramo. Consulta `route` de OSRM entre dos accesos con
  `alternatives=2`, geometría completa y pasos. Conserva únicamente opciones
  distintas con los mismos extremos exactos: no une calzadas diferentes mediante
  líneas inventadas ni cambia los otros tramos.
- `ConsultaAlternativasRuta` conserva la respuesta validada, responsable, versión,
  UUID y vencimiento. Consultar no cambia la versión del despacho ni invalida
  su aprobación. Los reintentos de la misma solicitud recuperan la consulta.
- `POST .../elegir-alternativa/` recibe versión, UUID, consulta y opción. El
  servidor usa la geometría que guardó; no admite geometría enviada por el
  navegador. Reemplaza solo el tramo seleccionado, recompone la línea continua
  y suma sus métricas con decimales exactos.
- Elegir crea un nuevo `PlanRutaDespacho`, conserva el anterior y registra la
  operación. No cambia carga, productos, cajillas, pedidos, paradas, colores ni
  el almacén de regreso. El plan nuevo requiere **Usar recorrido** antes de salir.
- Ambas acciones exigen el viaje propio, acceso vigente, permiso de operar,
  versión actual y estado pendiente de salida. Revalidan autorización y
  coordenadas después de OSRM; una optimización activa bloquea la comparación
  y la elección. Una consulta vencida o de otro plan/cuenta no puede aplicarse.
- Las consultas y elecciones integran auditoría HTTP y auditoría central.
  La web usa sesión/CSRF; se mantienen los accesos móviles existentes.
  La pasarela HTTPS permite únicamente estos dos POST del chofer.
- Una elección con respuesta incierta conserva UUID y cuerpo en memoria y ofrece
  **Comprobar resultado**, reutilizando el gestor de operaciones existente.

La migración `despachos/0008_alternativas_tramo` agrega únicamente la tabla de
consultas. No introduce dependencias nuevas ni modifica planes históricos.

## Comprobaciones

`Backend/despachos/test_alternativas_ruta.py` comprueba la comparación, selección,
reintentos, alcance, CSRF, permisos y coordenadas cambiantes, vencimiento,
optimización activa, viajes iniciados, continuidad, regreso y conservación de
operaciones. También comprueba que un fallo de auditoría revierte la elección.

`Frontend/pruebas/alternativas_ruta.mjs` comprueba comparación y vista previa,
contratos, consultas inciertas, respuestas tardías, vencimiento y ausencia de
alternativas, sin automatizar el navegador.

Validación del 4 de noviembre: **614 pruebas del backend, 211 web y cinco de
pasarela correctas**, TypeScript y ESLint del alcance correctos y compilación
pública de producción correcta. La prueba aislada con OSRM real devolvió uno,
uno y dos caminos en los tres tramos consultados; permitió elegir la alternativa
del regreso, confirmar el plan e iniciar ese viaje ficticio. No se probaron
operaciones en viajes habituales. La migración se aplicó tras un respaldo,
conservando los conteos de usuarios, viajes, planes, carga, pedidos, inventario
y cajillas.

Las comprobaciones HTTP públicas verificaron recursos y worker, sesión/CSRF,
rutas privadas, bloqueo de administración y navegación RSC sin redirecciones
adicionales. Ambos POST nuevos exigen autenticación; otros métodos se bloquean
en la pasarela. La administración local continuó disponible.

Para consultar OSRM real con un viaje ficticio y PostgreSQL aislado:

```powershell
.\Backend\.venv\Scripts\python.exe herramientas/comprobar_alternativas_osrm.py
```

Esta comprobación no crea ni inicia viajes en la base habitual. La revisión
visual en el teléfono es manual: verificar tema claro/oscuro, selección del tramo,
lectura de opciones, vista del mapa y confirmación antes de iniciar.
