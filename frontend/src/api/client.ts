const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://47.112.160.134:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  get: <T>(path: string) =>
    request<T>(path, {
      method: "GET",
    }),
};
