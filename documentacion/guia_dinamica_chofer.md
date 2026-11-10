# Guía dinámica del chofer web

El recorrido aprobado y la guía al siguiente destino son capas separadas. El
plan fijado conserva su geometría, paradas, orden, colores y regreso al mismo
almacén. La guía no cambia el despacho, ni registra llegadas, descargas,
inventario, cajillas o nuevos planes.

## Uso y comportamiento

1. Iniciar el viaje y autorizar **Compartir mi ubicación** como hasta ahora.
2. Con GPS válido, mostrar el camino pendiente del tramo activo. El camión
   conserva la coordenada medida y su círculo de precisión; no se desplaza
   artificialmente sobre la línea.
3. Si dos lecturas consecutivas quedan fuera del camino, consultar calles
   desde la posición actual hasta la misma sucursal, sin reordenar paradas.
4. Llegada y descarga parcial conservan el destino y el camino. Completar la
   descarga cambia a la siguiente sucursal; al completar todas, guía al almacén
   fijado en el plan.
5. **Ver recorrido completo** muestra el original y suspende la guía visual.
   La captura GPS mantiene su consentimiento independiente. El historial y
   el mapa administrativo siguen mostrando el plan original.

La tarjeta informa si se sigue el camino, se consulta otro o no hay guía.
La distancia pendiente es aproximada y se calcula sobre la geometría vial;
no se inventan tráfico, voz o tiempos de llegada.

## GPS y consultas

- Coordenadas finitas, precisión entre 0 y 100 m y lectura con diferencia de
  reloj de hasta 30 s, dentro de la sesión consentida del chofer y viaje.
- El recorte en memoria no consulta OSRM por cada lectura. La captura conserva
  su intervalo existente de 3 s. El umbral de desvío es el mayor entre 40 m y
  precisión + 20 m; una lectura aislada no dispara recálculo. En cruces próximos
  se prefiere la continuidad del tramo.
- Espera automática de 30 s después de la respuesta; el backend exige al menos
  15 s entre nuevas claves de la misma sesión. Una consulta pendiente se
  comprueba tras 5 s con el mismo UUID y cuerpo. Tras 25 s sin resolución se
  informa error al comprobarla; la consulta vence a los 90 s.
- Se utiliza el servicio [Route de OSRM](https://project-osrm.org/docs/v5.24.0/api/#route-service)
  mediante el adaptador existente, con GeoJSON. El origen se contrasta con GPS
  y precisión; el destino utiliza el acceso vial fijado. Los planes antiguos
  sin desglose conservan su línea global y reciben una guía separada.

Detener GPS, ocultar la pestaña, cambiar cuenta/sesión/destino o finalizar
retira la guía, cancela la solicitud local y descarta respuestas tardías.
Llegada y descarga parcial conservan el camino, pero invalidan una consulta
pendiente con versión anterior. No se hereda la espera de otra sesión/destino.
GPS antiguo retira la guía; un fallo de OSRM conserva el plan con aviso y
reintento limitado, sin dibujar rectas. Sigue siendo en primer plano, con
conexión y HTTPS en el teléfono, sin añadir segundo plano o modo sin conexión.

## Acceso e integridad

POST `/api/v1/chofer/mis-viajes/{id}/guia-destino/`, exclusivamente en la vista
web propia. No se añade a la API Bearer Android ni al panel administrativo.
La pasarela permite solo ese POST y conserva origen exacto, sesión/CSRF y sus
bloqueos administrativos.

Se revalidan autorización, acceso del navegador, sesión de seguimiento,
versión, plan fijado y siguiente destino antes y después de OSRM. Se bloquea
acceso, despacho y sesión; la red queda fuera de la transacción. Una reserva
por UUID evita repetir OSRM en peticiones simultáneas. Una misma clave con
otro cuerpo, sesión o posición se rechaza.

`ConsultaGuiaChofer` guarda origen, huella, sesión, plan, versión, tramo y
resultado como evidencia privada en PostgreSQL. No crea posiciones GPS ni
altera las originales. La auditoría HTTP se complementa con el servicio central
(`solicitar_guia_chofer`, `consultar_guia_chofer`), sin coordenadas en auditoría
o Redis. No se publican geometrías parciales ni se asignan nuevos permisos.

## Archivos y comprobación

- Backend: `despachos/guia_chofer.py`, modelo y migración `0009_guia_dinamica_chofer`.
- Dominio: `GuiaChofer.ts`, `geometriaGuia.ts`, `GestorGuiaChofer.ts` y repositorio HTTP.
- Interfaz: `useGuiaChofer`, `EstadoGuiaChofer`, pantalla y mapa existentes;
  textos en español/inglés y temas actuales.
- Pruebas aisladas de permisos, CSRF, GPS, versiones, UUID, concurrencia,
  auditoría, errores de OSRM, recorte, cruces, retorno y respuestas tardías.

La comprobación física se hace con el teléfono: avance, desvío, descarga y
regreso. No se automatiza el navegador/escritorio ni se simula GPS en viajes reales.

Validación del 9 de noviembre de 2026: 218 pruebas de Despachos y acceso HTTPS,
330 pruebas de frontend y 7 de pasarela correctas; TypeScript, ESLint, formato,
compilaciones local/pública y navegación HTML/RSC correctos. Migración aplicada
tras copia PostgreSQL comprobada en
`.local/guia-chofer-inicio/20261109-114329/base_antes_de_guia.dump`.
El acceso público se actualizó con una nueva URL temporal, disponible en
`.local/chofer_https/enlace.txt`; se verificaron sesión obligatoria, POST propio
y bloqueo administrativo. La prueba física con GPS real permanece manual.
