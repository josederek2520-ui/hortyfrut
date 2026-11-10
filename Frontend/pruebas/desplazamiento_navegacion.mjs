import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import * as jsx from "react/jsx-runtime";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

function prepararPantalla(desbordamiento = "") {
  let efectos = [];
  const documento = {
    body: { style: { overflow: desbordamiento } },
    activeElement: null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const cargar = crearCargadorChofer(
    {
      react: {
        useRef: (valor) => ({ current: valor }),
        useState: (valor) => [valor, () => {}],
        useEffect: (efecto) => efectos.push(efecto),
        useSyncExternalStore: () => true,
      },
      "react/jsx-runtime": jsx,
      "react-dom": { createPortal: (contenido) => contenido },
      "next-intl": { useTranslations: () => (clave) => clave },
      "lucide-react": new Proxy({}, { get: (_, nombre) => nombre }),
      "@/icons": new Proxy({}, { get: (_, nombre) => nombre }),
      "@/utils": { cn: (...clases) => clases.filter(Boolean).join(" ") },
      "@/i18n/navigation": {
        Link: "Enlace",
        usePathname: () => "/mis-viajes",
      },
      "@/context/SidebarContext": {
        useSidebar: () => ({ isMobileOpen: true }),
      },
      "@/lib/api": { api: async () => null },
      "@/lib/navegacion-sesion": { rutaInicial: () => "/mis-viajes" },
      "@/components/common/MarcaHortyfru": { default: "Marca" },
      "@/components/chat/ProveedorChat": { useChat: () => ({}) },
    },
    {
      document: documento,
      window: { addEventListener: () => {}, removeEventListener: () => {} },
    },
  );
  const Menu = cargar("layout/AppSidebar").default;
  const { Modal } = cargar("components/ui/modal/index");
  const montar = (componente) => {
    efectos = [];
    componente();
    const limpiezas = efectos.map((efecto) => efecto()).filter(Boolean);
    return () => limpiezas.forEach((limpiar) => limpiar());
  };
  return {
    documento,
    abrirMenu: () => montar(() => Menu()),
    abrirModal: () =>
      montar(() => Modal({ isOpen: true, onClose: () => {}, children: null })),
  };
}

for (const orden of ["menu-primero", "modal-primero"]) {
  prueba(`menú y diálogo liberan el scroll al navegar: ${orden}`, () => {
    const pantalla = prepararPantalla();
    const cerrarMenu = pantalla.abrirMenu();
    const cerrarModal = pantalla.abrirModal();
    const cierres =
      orden === "menu-primero"
        ? [cerrarMenu, cerrarModal]
        : [cerrarModal, cerrarMenu];
    afirmar.equal(pantalla.documento.body.style.overflow, "hidden");
    cierres[0]();
    afirmar.equal(pantalla.documento.body.style.overflow, "hidden");
    cierres[1]();
    afirmar.equal(pantalla.documento.body.style.overflow, "");
  });
}

prueba("reabrir el menú tras desmontarlo no deja bloqueos residuales", () => {
  const pantalla = prepararPantalla("auto");
  const cerrarPrimero = pantalla.abrirMenu();
  cerrarPrimero();
  const cerrarSegundo = pantalla.abrirMenu();
  cerrarPrimero();
  afirmar.equal(pantalla.documento.body.style.overflow, "hidden");
  cerrarSegundo();
  afirmar.equal(pantalla.documento.body.style.overflow, "auto");
});

prueba("cerrar los diálogos respeta un bloqueo externo anterior", () => {
  const pantalla = prepararPantalla("hidden");
  const cerrarModal = pantalla.abrirModal();
  cerrarModal();
  afirmar.equal(pantalla.documento.body.style.overflow, "hidden");
});
