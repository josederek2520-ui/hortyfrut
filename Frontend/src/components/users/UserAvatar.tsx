import type { User } from "./types";
export default function UserAvatar({
  user,
  large = false,
}: {
  user: Pick<User, "first_name" | "last_name">;
  large?: boolean;
}) {
  const initials =
    `${user.first_name[0] || ""}${user.last_name[0] || ""}`.toUpperCase() ||
    "U";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-brand-50 font-semibold text-brand-600 ring-1 ring-brand-100 ring-inset dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20 ${large ? "size-16 text-2xl" : "size-11 text-sm"}`}
    >
      {initials}
    </span>
  );
}
