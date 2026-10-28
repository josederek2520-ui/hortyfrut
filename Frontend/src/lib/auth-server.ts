import "server-only";
import { headers } from "next/headers";
import type { Session } from "@/components/users/types";
export async function getSession(): Promise<Session | null> {
  const incoming = await headers();
  const response = await fetch(
    `${process.env.DJANGO_API_URL || "http://127.0.0.1:8000"}/api/v1/auth/me/`,
    {
      headers: { Cookie: incoming.get("cookie") || "" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Service unavailable");
  return response.json();
}
