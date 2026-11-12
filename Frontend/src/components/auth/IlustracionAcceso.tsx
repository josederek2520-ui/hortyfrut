import {
  MapPin as IconoDestino,
  Truck as IconoCamion,
  Warehouse as IconoAlmacen,
} from "lucide-react";
import { IsotipoHortyfru } from "@/icons";
import estilos from "./estilosAcceso.module.css";

export default function IlustracionAcceso() {
  return (
    <div className={estilos.ilustracion} aria-hidden="true">
      <div className={estilos.camino} />
      <div className={estilos.almacen}>
        <IconoAlmacen className="size-14 text-brand-100" strokeWidth={1.25} />
      </div>
      <div className={estilos.carga}>
        <IsotipoHortyfru className="size-24" />
      </div>
      <div className={estilos.camion}>
        <IconoCamion
          className="size-16 text-brand-100 rtl:-scale-x-100"
          strokeWidth={1.25}
        />
      </div>
      <div className={estilos.destino}>
        <IconoDestino className="size-10 text-orange-300" strokeWidth={1.5} />
      </div>
      <span className={estilos.puntoOrigen} />
      <span className={estilos.puntoDestino} />
    </div>
  );
}
