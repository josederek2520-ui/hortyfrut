import Image from "next/image";
import { cn } from "@/utils";

export default function MarcaHortyfru({
  compacta = false,
  pequena = false,
  sobreOscuro = false,
  className,
}: {
  compacta?: boolean;
  pequena?: boolean;
  sobreOscuro?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="HortyFru"
      className={cn(
        "marca-hortyfru",
        compacta && "marca-hortyfru-compacta",
        pequena && "marca-hortyfru-pequena",
        sobreOscuro && "marca-hortyfru-sobre-oscuro",
        className,
      )}
    >
      <Image
        src="/images/marca/logo-hortyfru-claro-transparente.png"
        alt=""
        aria-hidden="true"
        width={1600}
        height={533}
        sizes={pequena ? "160px" : "240px"}
        className="marca-hortyfru-archivo marca-hortyfru-clara"
      />
      <Image
        src="/images/marca/logo-hortyfru-oscuro-transparente.png"
        alt=""
        aria-hidden="true"
        width={1600}
        height={533}
        sizes={pequena ? "160px" : "240px"}
        className="marca-hortyfru-archivo marca-hortyfru-oscura"
      />
    </span>
  );
}
