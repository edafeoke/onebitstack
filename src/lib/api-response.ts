export type ApiErrorBody = {
  error: string;
  code: string;
};

export function apiError(
  message: string,
  status: number,
  code = "ERROR"
): Response {
  return Response.json({ error: message, code } satisfies ApiErrorBody, { status });
}

export function apiOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/** Extract a user-facing message from API JSON bodies. */
export function messageFromApiBody(body: unknown, fallback = "Request failed"): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err) {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === "string") return msg;
    }
  }
  return fallback;
}
