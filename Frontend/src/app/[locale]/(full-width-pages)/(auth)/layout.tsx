import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import PresentacionAcceso from "@/components/auth/PresentacionAcceso";
import estilos from "@/components/auth/estilosAcceso.module.css";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${estilos.disposicion} relative`}>
      <div
        className={`${estilos.disposicion} grid gap-4 p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6 lg:p-6`}
      >
        {children}
        <PresentacionAcceso />
      </div>
      <div className="fixed end-6 top-6 z-50">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
