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
export default function ColorCajilla({ color }: { color: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <span
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${clasesColor[color.toLocaleLowerCase()] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
      >
        <IconoCajilla className="size-5" aria-hidden="true" />
      </span>
      <span className="font-medium break-words text-gray-900 dark:text-white">
        {color}
      </span>
    </span>
  );
}
