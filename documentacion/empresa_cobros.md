# Datos de la empresa, comprobante comercial y Cobros

## Datos de la empresa

Ruta local `/datos-empresa`, en Administración. Mantiene una única ficha con
razón social, NIT textual (conserva ceros iniciales), dirección, teléfono, ciudad
y logo opcional. La migración crea la ficha vacía: no copia datos de la factura
de referencia ni inventa información legal. El logo admite PNG/JPG/WebP de hasta
1 MB y 16 millones de píxeles; Pillow corrige orientación, elimina metadatos y lo
normaliza a PNG de hasta 800 × 400. Sin logo propio utiliza la marca existente.

Consultar y editar tienen permisos separados. El guardado usa versión, UUID,
cuerpo y responsable comprobados, bloqueo de la ficha y autorización fresca.
Guardar sin cambios no cambia la versión ni añade actividad principal. La
auditoría conserva una huella del logo y nunca su contenido base64.

## Documento de venta

Las ventas nuevas exigen completar los cinco datos de la empresa antes de
emitir. Su revisión incluye una huella de esos datos y del logo; un cambio
requiere revisar de nuevo. La emisión bloquea primero la ficha de empresa y
mantiene después el orden cliente → entregas → venta. Conserva en `Venta.empresa`
la instantánea completa, incluido el logo. No exige administrar Empresa para
emitir una venta: únicamente exige que la ficha esté completa.

El PDF usa una cabecera con empresa, NIT y número interno del documento, datos
del supermercado, tabla de código/producto/kg aceptados/precio por kg/importe,
total en Bs y su literal, responsable y páginas. Repite encabezados de tabla en
documentos extensos. Conserva **SIN VALOR FISCAL**; no genera autorización fiscal,
QR fiscal ni reproduce códigos del modelo. Los cálculos, redondeos, reparto de
centavos y textos de las líneas emitidas siguen siendo los existentes.

Las ventas anteriores con `empresa={}` conservan el generador histórico. No se
rellenan con datos actuales ni se cambia su importe al registrar cobros. El
PDF comercial no incluye un saldo recalculado ni acredita un pago.

## Cobros recibidos

Ruta local `/cobros`, en Comercial después de Ventas y saldos. Registra dinero
ya recibido por la oficina; no procesa transferencias ni ejecuta cargos.

1. Elegir un supermercado con ventas emitidas pendientes. Un cliente inactivo
   puede pagar sus deudas anteriores.
2. Escribir fecha, importe recibido en Bs y medio. Transferencia y depósito
   exigen subir un comprobante JPG, PNG, WebP o PDF de hasta 8 MB; se valida su
   contenido con el validador compartido. Efectivo y Otro no muestran ni admiten
   comprobante. Cheque se conserva solo en el historial y no se permite para
   nuevos cobros. Se rechazan fechas futuras. La referencia textual ya no se
   captura; los textos anteriores y el campo legado siguen disponibles.
3. Elegir hasta cien ventas del mismo cliente y escribir cuánto se aplica a
   cada una. No se completan importes ni se reparte dinero automáticamente.
   Las selecciones y cantidades se conservan entre búsquedas y páginas de diez.
4. Revisar la distribución completa. La suma debe coincidir exactamente con lo
   recibido, cada aplicación debe ser positiva y no superar el saldo vigente.
   **Importe asignado a ventas** indica lo ya repartido; **Falta asignar** muestra
   el dinero recibido que queda por aplicar. Si se excede, indica **Asignaste de
   más** con el exceso positivo. Estas cifras no representan la deuda restante.
5. Confirmar que el dinero fue recibido y registrar. La revisión no crea un
   cobro ni reduce deuda. El registro crea el cobro y sus aplicaciones en una
   transacción y conserva los saldos anterior/posterior de cada aplicación.
   La revisión incluye fecha, medio, nombre y huella del comprobante. Reemplazar
   el archivo invalida la revisión y exige comprobarla otra vez.

Una venta admite uno o varios pagos parciales, o un pago completo. Su estado se
calcula: Pendiente con cobrado cero, Pago parcial entre cero y su total, Pagada
al cubrirlo exactamente. El saldo es total emitido menos aplicaciones de cobros.
No existe un botón para marcarla pagada ni una edición directa del saldo.

Cada cobro registrado y sus aplicaciones son inmutables; no se ofrecen edición,
eliminación ni anulación. El importe se distribuye completamente: no se crean
anticipos, crédito no aplicado, devoluciones de dinero o compensaciones. El
portal **Mis pagos** permite ahora informar ingresos desde la cuenta propia del
supermercado; esos avisos no son cobros hasta su verificación local por HortyFru.
La confirmación reutiliza este servicio de registro y sus mismas reglas de saldo.
Ver [Mis pagos](mis_pagos.md) para alcance, permisos y comprobantes de los avisos.

El comprobante queda inmutable en `ComprobanteCobro`, vinculado uno a uno con el
cobro y guardado como bytes privados en PostgreSQL, con nombre, tipo, tamaño y
SHA-256. La misma transacción confirma archivo, cobro, aplicaciones y auditoría;
un fallo revierte todo. La auditoría guarda únicamente su huella. No se publica
en Media ni se crea un archivo temporal de negocio al revisar. La descarga
`GET /api/v1/cobros/{id}/comprobante/` requiere consultar Cobros, verifica integridad,
revalida autorización y usa descarga adjunta, sin caché, con nosniff y sandbox.
Los respaldos PostgreSQL incluyen el contenido automáticamente. El detalle del
cobro permite descargarlo y mantiene las referencias y medios históricos.

## Concurrencia y permisos

Permisos propios separados de consultar y registrar Cobros. No requiere consultar
Ventas ni administrar Clientes. Sus consultas auxiliares muestran solo los datos
necesarios del cliente y las ventas emitidas. Los cuatro permisos nuevos de
Empresa/Cobros aparecen en Roles y sesión, sin asignaciones automáticas.

El registro bloquea cliente y ventas por identificador ordenado, revalida la
autorización después de los bloqueos y verifica la versión del saldo de cada
venta y la huella de revisión. Dos cobros concurrentes no pueden exceder la deuda.
La clave UUID es única, ligada a cuerpo y responsable; se comprueba antes del
saldo en los reintentos para reconocer un cobro ya aplicado sin duplicarlo.
La restricción cobro/venta y los controles decimales mantienen aplicaciones
únicas, positivas y saldos exactos no negativos. Auditoría y aplicaciones se
confirman juntas; un fallo de auditoría revierte el cobro.

La interfaz conserva exactamente el UUID/cuerpo/destino en memoria ante una
respuesta incierta y bloquea cambios hasta reintentar. Actualizar saldos consulta
todas las páginas con una huella común y solo aplica el conjunto completo,
conservando los importes anotados. Salir, desmontar o cambiar de sesión descarta
respuestas tardías. No se persisten formularios ni archivos en el navegador.
Con comprobante se usa multipart: `datos` contiene el mismo JSON inmutable y
`comprobante` conserva los mismos bytes y nombre en revisión, registro y reintento.
La huella incluye sus metadatos y SHA-256, sin introducir bytes en JSON o auditoría.
Los reintentos de cobros históricos conservan su contrato y huella anteriores.

Las API usan sesión y CSRF, con respuestas privadas sin caché. Empresa y Cobros
no están registrados en la API pública ni en la pasarela HTTPS. No se modifica
inventario, cajillas, recepciones, pedidos, entregas, precios, viajes ni GPS.

## Validación y activación local

- Pruebas de servidor: pagos parciales/completos, centavos, varias ventas,
  excesos, clientes distintos, borradores, referencias, fechas, autorización,
  CSRF, UUID, fallos de auditoría y concurrencia con PostgreSQL aislado.
- Interfaz: validación de otras páginas, sumas exactas, revisión antes de
  registrar, reintentos inmutables, doble clic, cambio de sesión, actualización
  atómica de saldos, estados y traducciones español/inglés.
- El PDF se renderizó y revisó como imagen, con ejemplo de una página y pruebas
  extensas en español/inglés. La interfaz del navegador se revisa manualmente;
  no se automatiza el escritorio del usuario.
- Migraciones `empresa.0001_initial`, `ventas.0002_venta_empresa` y
  `cobros.0001_initial` aplicadas localmente el 12/11/2026, tras comprobar una
  copia PostgreSQL privada en `.local/finanzas/20261112-150001/`.
- La vista previa en `output/pdf/vista_previa_venta_hortyfru.pdf` usa datos
  ficticios y no crea ventas, cobros ni información de empresa en la base real.

Comprobación final: 100 pruebas de Empresa/Cobros/Ventas/Roles/Auditoría y 386
pruebas de interfaz correctas; ocho pruebas de pasarela confirman que las rutas
financieras permanecen locales. TypeScript, ESLint, formato, UTF-8 y compilación
de producción correctos. Las cinco páginas de empresa/cobros/detalle de venta
se comprobaron por HTTP con HTML y RSC y una cuenta ficticia, incluidos los
rechazos de acceso. Se verificó que las asignaciones de usuarios y roles siguen
iguales a la copia previa y que no se crearon cobros reales durante el desarrollo.

El 13/11/2026 se aplicó `cobros.0002_comprobante_cobro`, tras verificar el respaldo
privado `.local/cobros_comprobantes/20261113-123025/base_antes_de_comprobantes.dump`.
Las asignaciones de usuarios y roles se compararon con esa copia y permanecieron
intactas. Pasaron 128 pruebas de Empresa/Cobros/Ventas/Roles/Auditoría/Respaldos,
la suite de interfaz y la pasarela, incluida la denegación de comprobantes de
Cobros por HTTPS. La validación cubre multipart de más de 3 MB, registro atómico,
reintentos de los mismos bytes, revisión invalidada por otro archivo, descarga
privada y conservación del contrato histórico de cheques/referencias.
