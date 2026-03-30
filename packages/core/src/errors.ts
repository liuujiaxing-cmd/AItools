export const ERROR_CATALOG: Record<string, { zh: string; en: string; httpStatus: number }> = {
  "1xx.invalid_request": { zh: "请求格式不正确", en: "Invalid request", httpStatus: 400 },
  "2xx.tool_not_found": { zh: "工具不存在", en: "Tool not found", httpStatus: 404 },
  "2xx.tool_load_failed": { zh: "工具加载失败", en: "Tool load failed", httpStatus: 500 },
  "2xx.tool_invoke_failed": { zh: "工具执行失败", en: "Tool invocation failed", httpStatus: 500 },
  "3xx.unauthorized": { zh: "未授权", en: "Unauthorized", httpStatus: 401 },
  "3xx.forbidden": { zh: "禁止访问", en: "Forbidden", httpStatus: 403 },
  "3xx.signature_invalid": { zh: "签名校验失败", en: "Invalid signature", httpStatus: 401 },
  "3xx.rate_limited": { zh: "请求过于频繁", en: "Rate limited", httpStatus: 429 },
  "5xx.internal": { zh: "服务内部错误", en: "Internal server error", httpStatus: 500 }
};

export class ToolsetError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: any;

  constructor(code: string, details?: any) {
    super(ERROR_CATALOG[code]?.en ?? "Internal server error");
    this.code = code;
    this.httpStatus = ERROR_CATALOG[code]?.httpStatus ?? 500;
    this.details = details;
  }
}

export function pickLanguage(acceptLanguage?: string): "zh" | "en" {
  const v = (acceptLanguage ?? "").toLowerCase();
  if (v.startsWith("zh")) return "zh";
  return "en";
}

export function errorToResponse(err: unknown, acceptLanguage?: string, requestId?: string) {
  const lang = pickLanguage(acceptLanguage);
  if (err instanceof ToolsetError) {
    const msg = ERROR_CATALOG[err.code] ?? ERROR_CATALOG["5xx.internal"];
    return {
      statusCode: err.httpStatus,
      body: {
        error: {
          code: err.code,
          message: msg[lang],
          details: err.details,
          request_id: requestId
        }
      }
    };
  }
  const msg = ERROR_CATALOG["5xx.internal"];
  return {
    statusCode: 500,
    body: {
      error: {
        code: "5xx.internal",
        message: msg[lang],
        request_id: requestId
      }
    }
  };
}

