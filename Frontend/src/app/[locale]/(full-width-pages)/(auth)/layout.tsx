import AlternarTemaAcceso from "@/components/auth/AlternarTemaAcceso";
import PresentacionAcceso from "@/components/auth/PresentacionAcceso";
import estilos from "@/components/auth/estilosAcceso.module.css";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      className={`${estilos.disposicion} relative flex items-center justify-center px-4 pt-20 pb-6 sm:px-6 lg:py-20`}
    >
      <div
        className={`${estilos.tarjeta} grid w-full max-w-6xl overflow-hidden rounded-3xl border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}
      >
        {children}
        <PresentacionAcceso />
      </div>
      <div className="absolute end-4 top-4 sm:end-6 sm:top-6">
        <AlternarTemaAcceso />
      </div>
    </main>
  );
}
