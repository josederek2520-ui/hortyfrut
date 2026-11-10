import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useRouter, usePreventRemove } from "expo-router";
import { Check, ChevronDown, PackageCheck } from "lucide-react-native";
import {
  repositorioDespachos,
  gestorOperaciones,
} from "@/composicion/dependencias";
import { usarConsulta } from "@/compartido/aplicacion/usarConsulta";
import {
  Pantalla,
  Texto,
  Tarjeta,
  Boton,
  Aviso,
  EstadoCarga,
  Paginador,
} from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { usarSesion } from "@/modulos/sesion/presentacion/ProveedorSesion";
import { RevisionPedido } from "../aplicacion/RevisionPedido";
import { siguienteParada } from "../aplicacion/accionesViaje";
import { cantidad } from "@/modulos/despachos/presentacion/formatos";
import type { ProductoPedido } from "@/modulos/despachos/dominio/Viaje";
import { codigoError } from "@/compartido/dominio/Errores";
import type { ClaveMensaje } from "@/compartido/traducciones/mensajes";

function LotesProducto({ producto }: { producto: ProductoPedido }) {
  const [abierto, establecerAbierto] = useState(false),
    { colores, idioma, t } = usarInterfaz();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        onPress={() => establecerAbierto(!abierto)}
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Texto tipo="pequeno" color={colores.verdeTexto}>
          {t("lotes")}
        </Texto>
        <ChevronDown
          size={18}
          color={colores.verdeTexto}
          style={{ transform: [{ rotate: abierto ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {abierto &&
        producto.aportes.map((aporte) => (
          <View
            key={aporte.lote}
            style={{
              paddingVertical: 9,
              borderTopWidth: 1,
              borderColor: colores.borde,
            }}
          >
            <Texto tipo="pequeno" style={{ fontWeight: "700" }}>
              {aporte.codigo}
            </Texto>
            <Texto tipo="pequeno" color={colores.secundario}>
              {cantidad(aporte.cantidad, idioma)} {aporte.unidad} ·{" "}
              {cantidad(aporte.pesoKg, idioma)} kg
            </Texto>
          </View>
        ))}
    </View>
  );
}

export default function PantallaPedido({
  viajeId,
  paradaId,
  pedidoId,
}: {
  viajeId: number;
  paradaId: number;
  pedidoId: number;
}) {
  const { colores, idioma, t } = usarInterfaz(),
    { sesion } = usarSesion(),
    navegador = useRouter();
  const [pagina, establecerPagina] = useState(1),
    [ocupado, establecerOcupado] = useState(false),
    [error, establecerError] = useState("");
  const [bloqueado, establecerBloqueado] = useState(false),
    [, actualizarChecks] = useState(0);
  const [revision, establecerRevision] = useState<RevisionPedido | null>(null);
  const [salidaPermitida, establecerSalidaPermitida] = useState(false);
  const candado = useRef(false);
  const consultar = useCallback(
    async (senal: AbortSignal) => {
      const [viaje, productos] = await Promise.all([
        repositorioDespachos.detalle(viajeId, senal),
        repositorioDespachos.productos(
          viajeId,
          paradaId,
          pedidoId,
          pagina,
          senal,
        ),
      ]);
      return { viaje, productos };
    },
    [viajeId, paradaId, pedidoId, pagina],
  );
  const consulta = usarConsulta(
    `pedido:${viajeId}:${paradaId}:${pedidoId}:${pagina}`,
    consultar,
  );
  useEffect(() => {
    if (!consulta.datos || gestorOperaciones.pendiente(viajeId)) return;
    if (revision && revision.version !== consulta.datos.viaje.version) {
      establecerBloqueado(true);
      establecerError(t("error_conflicto"));
      return;
    }
    try {
      const actual =
        revision ?? new RevisionPedido(pedidoId, consulta.datos.viaje.version);
      actual.incorporar(
        consulta.datos.productos.registros,
        consulta.datos.productos.total,
      );
      if (!revision) establecerRevision(actual);
      actualizarChecks((valor) => valor + 1);
    } catch (problema) {
      establecerBloqueado(true);
      establecerError(t(`error_${codigoError(problema)}` as ClaveMensaje));
    }
  }, [consulta.datos, pedidoId, viajeId, t, revision]);
  const desactivarPrevencion = usePreventRemove(
    !!sesion &&
      !salidaPermitida &&
      (ocupado ||
        (!!revision?.cantidad && !gestorOperaciones.pendiente(viajeId))),
    ({ repeat }) => {
      if (candado.current) return;
      Alert.alert(t("salirPedido"), t("cambiosRevision"), [
        { text: t("cancelar"), style: "cancel" },
        {
          text: t("volver"),
          onPress: () => {
            establecerSalidaPermitida(true);
            repeat();
          },
        },
      ]);
    },
  );
  const actualizar = () => {
    if (candado.current || gestorOperaciones.pendiente(viajeId)) return;
    establecerRevision(null);
    establecerBloqueado(false);
    establecerError("");
    establecerPagina(1);
    consulta.recargar();
  };
  const confirmar = async (reintento: boolean) => {
    if (candado.current || (!reintento && (!revision?.completa || bloqueado)))
      return;
    candado.current = true;
    establecerOcupado(true);
    establecerError("");
    try {
      if (reintento) await gestorOperaciones.reintentar(viajeId);
      else
        await gestorOperaciones.ejecutar(viajeId, "descargar-pedido", {
          version: revision!.version,
          parada: paradaId,
          pedido: pedidoId,
          cargas_comprobadas: revision!.obtenerComprobadas(),
        });
      establecerSalidaPermitida(true);
      desactivarPrevencion();
      navegador.replace({
        pathname: "/(chofer)/viaje/[identificador]",
        params: { identificador: viajeId },
      });
    } catch (problema) {
      establecerError(t(`error_${codigoError(problema)}` as ClaveMensaje));
      if (!gestorOperaciones.pendiente(viajeId)) establecerBloqueado(true);
    } finally {
      candado.current = false;
      establecerOcupado(false);
    }
  };
  const datos = consulta.datos,
    pendiente = gestorOperaciones.pendiente(viajeId);
  const viaje = datos?.viaje,
    productos = datos?.productos,
    parada = viaje?.paradas.find((fila) => fila.id === paradaId);
  const entregado = !!productos?.registros[0]?.descargadaEn;
  const habilitado =
    !!sesion?.puedeOperar &&
    viaje?.estado === "en_ruta" &&
    siguienteParada(viaje)?.id === paradaId &&
    !!parada?.llegadaEn &&
    !entregado;
  const pendientePropio = pendiente?.documento.pedido === pedidoId;
  const pie = pendiente ? (
    <Boton
      titulo={t(pendientePropio ? "reintentar" : "volver")}
      ocupado={ocupado}
      alPulsar={() =>
        pendientePropio
          ? void confirmar(true)
          : navegador.replace({
              pathname: "/(chofer)/viaje/[identificador]",
              params: { identificador: viajeId },
            })
      }
    />
  ) : habilitado ? (
    <>
      <Texto tipo="pequeno" color={colores.secundario}>
        {t("comprobados", {
          cantidad: revision?.cantidad ?? 0,
          total: productos?.total ?? 0,
        })}
      </Texto>
      <Boton
        titulo={t("confirmarDescarga")}
        ocupado={ocupado}
        deshabilitado={
          !revision?.completa ||
          bloqueado ||
          consulta.cargando ||
          !!consulta.error
        }
        alPulsar={() =>
          Alert.alert(t("confirmarPedido"), t("confirmarPedidoAyuda"), [
            { text: t("cancelar"), style: "cancel" },
            {
              text: t("confirmarDescarga"),
              onPress: () => void confirmar(false),
            },
          ])
        }
      />
    </>
  ) : undefined;
  return (
    <Pantalla
      titulo={productos?.registros[0]?.codigoPedido ?? t("pedido")}
      ayuda={parada ? `${parada.cliente} · ${parada.nombre}` : undefined}
      volver
      pie={pie}
    >
      {pendiente ? <Aviso>{t("inciertoAyuda")}</Aviso> : null}
      {error ? (
        <>
          <Aviso error>{error}</Aviso>
          {bloqueado && !pendiente && (
            <Boton titulo={t("actualizar")} alPulsar={actualizar} secundario />
          )}
        </>
      ) : null}
      {consulta.cargando || consulta.error || !datos ? (
        <EstadoCarga error={consulta.error} alReintentar={actualizar} />
      ) : (
        <>
          {entregado ? (
            <Tarjeta>
              <PackageCheck size={32} color={colores.verdeTexto} />
              <Texto tipo="subtitulo">{t("descargaLista")}</Texto>
            </Tarjeta>
          ) : (
            <Aviso>{t(habilitado ? "revisarAyuda" : "pendiente")}</Aviso>
          )}
          {productos?.registros.map((producto) => (
            <Tarjeta key={producto.id}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={t("seleccionarProducto", {
                  nombre: producto.nombre,
                })}
                accessibilityState={{
                  checked: revision?.estaComprobada(producto.id) ?? false,
                  disabled: !habilitado || ocupado || bloqueado || !!pendiente,
                }}
                disabled={!habilitado || ocupado || bloqueado || !!pendiente}
                onPress={() => {
                  revision?.alternar(producto.id);
                  actualizarChecks((valor) => valor + 1);
                }}
                style={{
                  minHeight: 60,
                  flexDirection: "row",
                  gap: 13,
                  alignItems: "center",
                }}
              >
                {habilitado && (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      borderWidth: 1.5,
                      borderColor: colores.verde,
                      backgroundColor: revision?.estaComprobada(producto.id)
                        ? colores.verde
                        : colores.tarjeta,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {revision?.estaComprobada(producto.id) && (
                      <Check size={20} color={colores.blanco} />
                    )}
                  </View>
                )}
                <View style={{ flex: 1, gap: 5 }}>
                  <Texto tipo="subtitulo">{producto.nombre}</Texto>
                  <Texto
                    color={colores.verdeTexto}
                    style={{ fontWeight: "700" }}
                  >
                    {t(producto.columna === "cajas" ? "cajas" : "unidades", {
                      cantidad: producto.cantidad,
                    })}{" "}
                    · {cantidad(producto.pesoKg, idioma)} kg
                  </Texto>
                  <Texto tipo="pequeno" color={colores.secundario}>
                    {producto.presentacion} · {producto.codigoPreparacion}
                  </Texto>
                </View>
              </Pressable>
              <LotesProducto producto={producto} />
            </Tarjeta>
          ))}
          <Paginador
            pagina={pagina}
            total={productos?.total ?? 0}
            alCambiar={establecerPagina}
            ocupado={ocupado || !!pendiente}
          />
          <Aviso>{t("cajillasAyuda")}</Aviso>
        </>
      )}
    </Pantalla>
  );
}
