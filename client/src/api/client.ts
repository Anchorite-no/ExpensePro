import { useAuth } from "../context/AuthContext";

type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";

export async function request<T>(
  url: string,
  method: RequestMethod = "GET",
  body?: any,
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // 简单处理：如果 401，抛出特定错误供上层捕获或重定向
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "API Error");
  }

  return res.json();
}
