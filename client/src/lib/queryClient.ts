import { QueryClient, QueryFunction } from "@tanstack/react-query";

const EDITOR_TOKEN_KEY = "shadows-editor-token";

export function setEditorToken(token: string | null) {
  if (token) localStorage.setItem(EDITOR_TOKEN_KEY, token);
  else localStorage.removeItem(EDITOR_TOKEN_KEY);
}

export function getEditorToken(): string | null {
  try { return localStorage.getItem(EDITOR_TOKEN_KEY); } catch { return null; }
}

// The app runs inside a cross-site iframe (canvas preview) where browsers block
// third-party cookies, so the editor session cookie can't be relied on. We send
// a token (issued at login, stored in localStorage) in this header as a fallback.
export function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = getEditorToken();
  return token ? { ...base, "x-editor-token": token } : base;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders(),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
