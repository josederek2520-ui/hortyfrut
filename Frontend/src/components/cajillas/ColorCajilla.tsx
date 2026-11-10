import { Container as IconoCajilla } from "lucide-react";

const clasesColor: Record<string, string> = {
  verde:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  green:
    "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
  azul: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  rojo: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  red: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  amarillo:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  yellow:
    "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  naranja:
    "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  orange:
    "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
};
const clasesPunto: Record<string, string> = {
  verde: "bg-success-500",
  green: "bg-success-500",
  azul: "bg-blue-500",
  blue: "bg-blue-500",
  rojo: "bg-error-500",
  red: "bg-error-500",
  amarillo: "bg-warning-400",
  yellow: "bg-warning-400",
  naranja: "bg-orange-500",
  orange: "bg-orange-500",
  blanco: "bg-white",
  white: "bg-white",
  negro: "bg-gray-950",
  black: "bg-gray-950",
  gris: "bg-gray-400",
  gray: "bg-gray-400",
  grey: "bg-gray-400",
  morado: "bg-theme-purple-500",
  violeta: "bg-theme-purple-500",
  purple: "bg-theme-purple-500",
  violet: "bg-theme-purple-500",
  rosa: "bg-theme-pink-500",
  rosado: "bg-theme-pink-500",
  pink: "bg-theme-pink-500",
};
export default function ColorCajilla({
  color,
  compacta = false,
  punto = false,
}: {
  color: string;
  compacta?: boolean;
  punto?: boolean;
}) {
  const claveColor = color.trim().toLocaleLowerCase();
  if (punto)
    return (
      <span className="inline-flex max-w-full min-w-0 items-center gap-2 align-middle">
        {clasesPunto[claveColor] ? (
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 rounded-full ring-1 ring-gray-300 dark:ring-gray-500 ${clasesPunto[claveColor]}`}
          />
        ) : (
          <IconoCajilla
            aria-hidden="true"
            className="size-4 shrink-0 text-gray-400"
          />
        )}
        <span className="truncate font-medium text-gray-900 dark:text-gray-100">
          {color}
        </span>
      </span>
    );
  return (
    <span
      className={`inline-flex min-w-0 items-center ${compacta ? "gap-2" : "gap-3"}`}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-xl ${compacta ? "size-7" : "size-10"} ${clasesColor[claveColor] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
      >
        <IconoCajilla
          className={compacta ? "size-4" : "size-5"}
          aria-hidden="true"
        />
      </span>
      <span className="font-medium break-words text-gray-900 dark:text-white">
        {color}
      </span>
    </span>
  );
}
