# Etapa 1: ubicaciones y capacidad de los vehículos

30 de octubre de 2026

## Estado

La implementación de la etapa 1 está lista. El cierre operativo queda pendiente de que el usuario registre y confirme las ubicaciones reales del piloto y revise la capacidad declarada del vehículo. No se inventaron coordenadas ni se modificaron registros de negocio para completar esos datos.

## Qué cambió en el sistema

- Antes de iniciar un despacho, Django compara el peso real de todos los productos preparados con la capacidad actual del vehículo. La comprobación ocurre dentro de la transacción y con el vehículo bloqueado, antes de mover cajillas o cambiar el estado del viaje.
- Si falta capacidad, falta algún peso real o la carga supera la capacidad, la salida se bloquea con una explicación. El peso justo en el límite sí se admite.
- Los borradores siguen pudiendo guardarse para completar datos o cambiar el vehículo. La capacidad del catálogo sigue siendo opcional; se exige antes de iniciar el viaje.
- La interfaz muestra «Capacidad sin verificar», «La carga supera la capacidad» o «Dentro de la capacidad». El botón de iniciar respeta ese resultado. Si la capacidad cambia desde otra sesión, el servidor vuelve a comprobarla al iniciar.
- La capacidad se mantiene en toneladas en la interfaz y en `capacidad_kg` en la API. Los cálculos usan decimales exactos. Por ejemplo, 2 t admiten 1500 kg y dejan 500 kg de margen; 50 kg se admiten con capacidad de 50 kg, pero 50,001 kg la superan.
- La comprobación utiliza los pesos medidos de los aportes de todos los lotes y asignaciones, incluidas las que están en otras páginas. Cajas y unidades del pedido no se convierten en kilos. Un peso ausente no se interpreta como cero.
- Al editar y revisar un borrador se conserva la capacidad actual recibida del backend. El detalle expone los campos de solo lectura `vehiculo_capacidad_kg` y `comprobacion_capacidad` sin exigir administrar Vehículos.
- Almacenes y sucursales identifican las ubicaciones pendientes. Los formularios explican que se necesita el punto real de entrada o descarga del camión.
- Los textos nuevos están disponibles en español e inglés, con el diseño, contraste y componentes existentes.

Los viajes que ya están en ruta pueden completar su operación. Los reintentos de una salida ya confirmada conservan su respuesta y no vuelven a generar movimientos. Esta etapa no añade otra salida de productos de inventario.

## Qué debe completar el usuario

La consulta del 30 de octubre se hizo en una transacción PostgreSQL de solo lectura. Se encontraron estos registros activos:

| Registro existente | Dónde editarlo | Falta o revisión |
| --- | --- | --- |
| Almacén Central, ID 1 | Almacenes → Almacén Central → Editar | Latitud y longitud del acceso real del camión |
| Hipermaxi · Miraflores, sucursal ID 14 | Clientes → Hipermaxi → Sucursales → Miraflores → Editar | Latitud y longitud del lugar real de descarga; revisar también su dirección actual, que solo dice «MIraflores» |
| Hipermaxi · Satelite, sucursal ID 12 | Clientes → Hipermaxi → Sucursales → Satelite → Editar | Latitud y longitud del lugar real de descarga |
| Vehículo 453VFC, ID 1 | Vehículos → 453VFC → Editar | Ya tiene 2 t registradas; confirmar que corresponden a su capacidad real de carga |

No hace falta crear otro almacén, cliente, sucursal ni vehículo para este piloto. Edita estos registros existentes.

Para cada ubicación:

1. Identifica en el mapa la entrada o el lugar donde efectivamente descarga el camión.
2. Copia la latitud y longitud decimales, conservando los signos negativos cuando correspondan. Registra ambas coordenadas; no intercambies su orden.
3. Guarda y abre «Ver ubicación en el mapa» para confirmar el punto. Revisa físicamente o con la persona responsable el acceso de camiones y las restricciones de entrada.

Guardar coordenadas solo significa que quedaron registradas. No certifica por sí mismo que el camión pueda acceder. El usuario debe confirmar esa información real.

## Qué todavía no corresponde a esta etapa

Las coordenadas pendientes no bloquean el despacho manual actual. Aún no hay cálculo de rutas, mapa de seguimiento, GPS ni aplicación Android. Tampoco se pide una clave de mapas en esta etapa.

La futura publicación administrativa corresponde a la etapa 2. Su servicio deberá reutilizar la comprobación de capacidad ya implementada y mantener la validación antes de la salida física. Se conserva la decisión de que el recorrido del piloto regresa al mismo almacén de salida.

`comprobacion_capacidad` informa el resultado con la capacidad actual del vehículo; no es una certificación histórica ni una capacidad congelada al publicar. La publicación y sus datos históricos se implementarán en su etapa.

No se requirieron nuevas dependencias, campos ni migraciones. Los campos de coordenadas y capacidad ya existían. La auditoría de escrituras sigue pasando por los servicios y la capa HTTP existentes.

## Verificación técnica

Resultado: 449 pruebas de backend y 148 de frontend aprobadas, compilación de producción y TypeScript correctos, ESLint sin errores en los componentes revisados y ninguna migración pendiente. El servidor de desarrollo no informó errores de configuración o sesión al consultar sus diagnósticos. No se automatizó el navegador ni se probó un teléfono en esta etapa.

Se incorporaron pruebas de límites exactos, capacidad ausente, pesos incompletos o inconsistentes, sumas de más de diez asignaciones, revalidación con la capacidad actual, permisos, conservación del inventario, bloqueo sin movimientos, reintentos y continuidad del despacho manual sin coordenadas.

Comandos reproducibles desde Backend y Frontend, respectivamente:

```powershell
.venv/Scripts/python.exe manage.py test usuarios roles auditoria catalogos productos clientes pedidos proveedores compras almacenes inventario recepciones cajillas preparaciones vehiculos despachos --settings=config.pruebas_aisladas --keepdb --noinput
.venv/Scripts/python.exe manage.py makemigrations --check --dry-run --settings=config.pruebas_aisladas
```

```powershell
node --test pruebas/*.mjs
npx.cmd --no-install tsc --noEmit
npm.cmd run build
```

Las pruebas de Django usan exclusivamente la base aislada de pruebas configurada en la etapa cero. Los datos reales pendientes se conservan para que el usuario los complete.

## Siguiente paso

Completar y confirmar los tres puntos reales y verificar las 2 t del vehículo. Después continúa la etapa 2: acceso móvil del chofer, consulta de sus viajes y publicación administrativa, con permisos separados y sin darle acceso a todos los despachos.
