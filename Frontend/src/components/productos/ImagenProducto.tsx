"use client";
import { useState } from "react";
import Image from "next/image";
import { IconoProducto } from "@/icons";

export default function ImagenProducto({
  origen,
  nombre,
  grande = false,
}: {
  origen: string | null;
  nombre: string;
  grande?: boolean;
}) {
  const [origenFallido, establecerOrigenFallido] = useState<string | null>(
    null,
  );
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400 ${grande ? "aspect-square w-full" : "size-11"}`}
    >
      {origen && origen !== origenFallido ? (
        <Image
          src={origen}
          alt={nombre}
          fill
          unoptimized
          sizes={grande ? "320px" : "44px"}
          className="object-cover"
          onError={() => establecerOrigenFallido(origen)}
        />
      ) : (
        <IconoProducto
          className={grande ? "size-14" : "size-5"}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
