import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { crearCargador } from "./cargar.mjs";

const cargar = crearCargador();
const { RepositorioSesionHttp } = cargar(
  "modulos/sesion/datos/RepositorioSesionHttp",
);
const { ErrorAplicacion } = cargar("compartido/dominio/Errores");

for (const respuestaAnterior of ["valida", "revocada"]) {
  prueba(
    `una restauracion ${respuestaAnterior} anterior no sustituye ni elimina la credencial nueva`,
    async () => {
      let guardada = {
        usuario: { id: 1, nombre: "Anterior" },
        credencial: "anterior",
        servidor: "https://sistema.test/api/v1/",
        venceEn: "2035-01-01T00:00:00Z",
      };
      let terminarAnterior;
      let llegoConsulta;
      const consultaIniciada = new Promise((resolver) => {
        llegoConsulta = resolver;
      });
      const cliente = {
        servidor: guardada.servidor,
        solicitar: async (ruta, opciones) => {
          if (ruta === "movil/iniciar-sesion/")
            return {
              usuario: { id: 2, nombre: "Actual" },
              credencial: "actual",
              vence_en: guardada.venceEn,
            };
          if (opciones.credencial === "anterior") {
            llegoConsulta();
            return new Promise((resolver, rechazar) => {
              terminarAnterior = () =>
                respuestaAnterior === "valida"
                  ? resolver({
                      usuario: { id: 1, nombre: "Anterior" },
                      puede_operar: true,
                      vence_en: guardada.venceEn,
                    })
                  : rechazar(new ErrorAplicacion("sesion", 401));
            });
          }
          return { puede_operar: true };
        },
      };
      const almacen = {
        sesion: async () => guardada,
        leer: async () => "dispositivo",
        guardar: async (clave, valor) => {
          if (clave === "hortyfru.sesion") guardada = JSON.parse(valor);
        },
        eliminar: async () => {
          guardada = null;
        },
      };
      const repositorio = new RepositorioSesionHttp(
        cliente,
        almacen,
        () => "uuid",
      );
      const restauracion = repositorio.restaurar();
      await consultaIniciada;
      await repositorio.ingresar("actual@hortyfru.test", "clave");
      terminarAnterior();
      afirmar.equal(await restauracion, null);
      afirmar.equal(guardada.credencial, "actual");
      afirmar.equal(guardada.usuario.id, 2);
    },
  );
}
