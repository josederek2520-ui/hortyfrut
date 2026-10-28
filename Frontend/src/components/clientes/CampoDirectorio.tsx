"use client";
import type { InputHTMLAttributes } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

interface Propiedades extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "step"
> {
  etiqueta: string;
  errores?: string[];
  ayuda?: string;
  step?: number;
}

export default function CampoDirectorio({
  etiqueta,
  errores,
  ayuda,
  id,
  required,
  ...propiedades
}: Propiedades) {
  const invalido = !!errores?.length;
  return (
    <div>
      <Label htmlFor={id}>
        {etiqueta} {required && <span className="text-error-500">*</span>}
      </Label>
      <Input
        {...propiedades}
        id={id}
        required={required}
        error={invalido}
        aria-describedby={invalido || ayuda ? `${id}-ayuda` : undefined}
      />
      <p
        id={`${id}-ayuda`}
        className={`mt-1.5 text-theme-xs leading-5 ${invalido ? "text-error-500 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}
      >
        {invalido ? errores.join(" ") : ayuda}
      </p>
    </div>
  );
}
