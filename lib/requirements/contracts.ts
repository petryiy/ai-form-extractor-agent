import { z } from "zod";
import { requirementCriteria, requirementStateSchema } from "@/lib/requirements/schema";

const criterionKeys = requirementCriteria.map((criterion) => criterion.key) as [
  string,
  ...string[]
];

export const visibleMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().max(12000)
  })
  .passthrough();

export const extractRequestSchema = z.object({
  sessionId: z.string().min(1).max(160),
  messages: z.array(visibleMessageSchema).max(60),
  currentState: requirementStateSchema
});

export const extractionUpdateSchema = z.object({
  patch: requirementStateSchema
    .partial()
    .describe(
      "Only fields explicitly supported by the transcript. Use null only when the user retracts or clears a prior answer."
    ),
  nextQuestion: z
    .string()
    .min(1)
    .max(600)
    .nullable()
    .describe("One concise follow-up question in Chinese, or null if no follow-up is needed."),
  customerIntent: z
    .enum(["provide_requirements", "change_previous_answer", "off_topic", "not_sure", "done"])
    .describe("The customer's dominant intent in the latest turn."),
  evidence: z
    .array(
      z.object({
        field: z.enum(criterionKeys),
        quote: z.string().min(1).max(500)
      })
    )
    .max(12)
    .describe("Short transcript evidence for every changed field."),
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string().min(1).max(320)).max(6)
});

export const extractResponseSchema = z.object({
  state: requirementStateSchema,
  completeness: z.number().min(0).max(1),
  missing: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      question: z.string(),
      required: z.boolean()
    })
  ),
  nextQuestion: z.string().nullable(),
  changes: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      action: z.enum(["created", "updated", "cleared"]),
      previousValue: z.unknown(),
      nextValue: z.unknown()
    })
  ),
  evidence: z.array(
    z.object({
      field: z.string(),
      quote: z.string()
    })
  ),
  customerIntent: z.enum(["provide_requirements", "change_previous_answer", "off_topic", "not_sure", "done"]),
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string()),
  updatedAt: z.string()
});

export const extractionHistoryItemSchema = z.object({
  updatedAt: z.string(),
  completeness: z.number().min(0).max(1),
  changes: extractResponseSchema.shape.changes,
  evidence: extractResponseSchema.shape.evidence,
  customerIntent: extractResponseSchema.shape.customerIntent,
  confidence: z.number().min(0).max(1),
  notes: z.array(z.string())
});

export const storedRequirementSessionSchema = z.object({
  sessionId: z.string(),
  state: requirementStateSchema,
  messages: z.array(visibleMessageSchema),
  extractionHistory: z.array(extractionHistoryItemSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const sessionSummarySchema = z.object({
  sessionId: z.string(),
  state: requirementStateSchema,
  completeness: z.number().min(0).max(1),
  messageCount: z.number().int().min(0),
  extractionCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionSummarySchema)
});

export type VisibleMessage = z.infer<typeof visibleMessageSchema>;
export type ExtractResponse = z.infer<typeof extractResponseSchema>;
export type StoredRequirementSession = z.infer<typeof storedRequirementSessionSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
