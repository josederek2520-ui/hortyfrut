import Imagen from "next/image";
import { Truck as IconoVehiculo } from "lucide-react";

export default function FotoVehiculo({
  imagen,
  placa,
  amplia = false,
}: {
  imagen: string | null;
  placa: string;
  amplia?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800/40 ${amplia ? "aspect-4/3 p-6 sm:p-8" : "aspect-video p-4"}`}
    >
      {imagen ? (
        <Imagen
          width={800}
          height={600}
          unoptimized
          src={imagen}
          alt={placa}
          className="h-full min-h-0 w-full object-contain"
        />
      ) : (
        <IconoVehiculo
          className={`${amplia ? "size-24" : "size-16"} text-gray-300 dark:text-gray-600`}
          strokeWidth={1.25}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
