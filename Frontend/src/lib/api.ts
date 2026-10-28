export class ApiError extends Error {
  constructor(
    public status: number,
    public errors: Record<string, string[]> = {},
    message = "",
    public code = "",
  ) {
    super(message);
  }
}
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfPromise ??= fetch("/api/v1/auth/csrf/", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) throw new ApiError(response.status);
      const data = await response.json();
      csrfToken = data.csrfToken;
      return data.csrfToken as string;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retryCsrf = true,
): Promise<T> {
  const method = options.method || "GET";
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("X-CSRFToken", await getCsrf());
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      ...options,
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0);
  }
  const data = await response.json().catch(() => ({}));
  if (
    response.status === 403 &&
    retryCsrf &&
    (data.code === "csrf_failed" ||
      String(data.detail || "").startsWith("CSRF Failed:"))
  ) {
    csrfToken = null;
    return api<T>(path, options, false);
  }
  if (!response.ok) {
    const errors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(data.errors || {}))
      errors[key] = Array.isArray(value) ? value.map(String) : [String(value)];
    throw new ApiError(
      response.status,
      errors,
      data.detail || "",
      data.code || "",
    );
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (path === "auth/logout/") csrfToken = null;
  return data as T;
}
