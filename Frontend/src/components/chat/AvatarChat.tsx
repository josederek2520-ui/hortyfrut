export default function AvatarChat({ nombre }: { nombre: string }) {
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 ring-inset dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/20"
    >
      {iniciales || "U"}
    </span>
  );
}
