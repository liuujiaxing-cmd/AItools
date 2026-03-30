import { z } from "zod";

export const ExecutionContextSchema = z
  .object({
    trace_id: z.string().optional(),
    user_id: z.string().optional(),
    api_key_id: z.string().optional(),
    request_id: z.string().optional(),
    locale: z.string().optional(),
    extra: z.record(z.any()).default({})
  })
  .strict();

export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

export const ToolInvokeRequestSchema = z
  .object({
    input: z.record(z.any()).default({}),
    context: ExecutionContextSchema.default({ extra: {} }),
    options: z.record(z.any()).default({})
  })
  .strict();

export type ToolInvokeRequest = z.infer<typeof ToolInvokeRequestSchema>;

export type ToolInvokeResponse = {
  output: Record<string, any>;
  meta: Record<string, any>;
};

export type ToolMetadata = {
  name: string;
  version: string;
  description: string;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  cache_ttl_seconds?: number;
  tags?: string[];
};

export type Tool = {
  metadata(): ToolMetadata;
  invoke(input: Record<string, any>, context: ExecutionContext): Promise<Record<string, any>>;
};

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: any;
    request_id?: string;
  };
};

