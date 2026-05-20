import { z } from "zod";

const nullableTrimmedStringBase = (maxLength = 600) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().min(1).max(maxLength).nullable()
  );

const nullableTrimmedString = (maxLength = 600) =>
  nullableTrimmedStringBase(maxLength).default(null);

const nullableStringArrayBase = (maxItems = 12, maxItemLength = 240) =>
  z.preprocess(
    (value) => {
      if (!Array.isArray(value)) {
        return value;
      }

      const cleaned = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);

      return cleaned.length > 0 ? Array.from(new Set(cleaned)) : null;
    },
    z.array(z.string().min(1).max(maxItemLength)).max(maxItems).nullable()
  );

const nullableStringArray = (maxItems = 12, maxItemLength = 240) =>
  nullableStringArrayBase(maxItems, maxItemLength).default(null);

const dataSensitivityBaseSchema = z
  .enum(["low", "medium", "high", "regulated", "unknown"])
  .nullable();

export const dataSensitivitySchema = dataSensitivityBaseSchema.default(null);

export const requirementStateSchema = z.object({
  industry: nullableTrimmedString(160),
  companySize: nullableTrimmedString(120),
  corePainPoints: nullableStringArray(8, 280),
  compellingEvent: nullableTrimmedString(500),
  currentWorkflow: nullableTrimmedString(900),
  specificWorkflow: nullableTrimmedString(1200),
  targetUsers: nullableStringArray(8, 180),
  authority: nullableTrimmedString(700),
  alternativeSolution: nullableTrimmedString(700),
  platformPreference: nullableStringArray(6, 160),
  mustHaveFeatures: nullableStringArray(12, 240),
  niceToHaveFeatures: nullableStringArray(12, 240),
  budgetRange: nullableTrimmedString(160),
  timeline: nullableTrimmedString(160),
  successMetrics: nullableStringArray(8, 240),
  integrations: nullableStringArray(12, 180),
  stakeholders: nullableStringArray(10, 180),
  constraints: nullableStringArray(10, 240),
  dataSensitivity: dataSensitivitySchema,
  decisionProcess: nullableTrimmedString(600),
  additionalContext: nullableTrimmedString(1200)
});

export const requirementPatchSchema = z.object({
  industry: nullableTrimmedStringBase(160).optional(),
  companySize: nullableTrimmedStringBase(120).optional(),
  corePainPoints: nullableStringArrayBase(8, 280).optional(),
  compellingEvent: nullableTrimmedStringBase(500).optional(),
  currentWorkflow: nullableTrimmedStringBase(900).optional(),
  specificWorkflow: nullableTrimmedStringBase(1200).optional(),
  targetUsers: nullableStringArrayBase(8, 180).optional(),
  authority: nullableTrimmedStringBase(700).optional(),
  alternativeSolution: nullableTrimmedStringBase(700).optional(),
  platformPreference: nullableStringArrayBase(6, 160).optional(),
  mustHaveFeatures: nullableStringArrayBase(12, 240).optional(),
  niceToHaveFeatures: nullableStringArrayBase(12, 240).optional(),
  budgetRange: nullableTrimmedStringBase(160).optional(),
  timeline: nullableTrimmedStringBase(160).optional(),
  successMetrics: nullableStringArrayBase(8, 240).optional(),
  integrations: nullableStringArrayBase(12, 180).optional(),
  stakeholders: nullableStringArrayBase(10, 180).optional(),
  constraints: nullableStringArrayBase(10, 240).optional(),
  dataSensitivity: dataSensitivityBaseSchema.optional(),
  decisionProcess: nullableTrimmedStringBase(600).optional(),
  additionalContext: nullableTrimmedStringBase(1200).optional()
});

export type DataSensitivity = z.infer<typeof dataSensitivitySchema>;
export type RequirementState = z.infer<typeof requirementStateSchema>;
export type RequirementPatch = z.infer<typeof requirementPatchSchema>;
export type RequirementKey = keyof RequirementState;

export type RequirementCriterion = {
  key: RequirementKey;
  label: string;
  description: string;
  question: string;
  required: boolean;
};

export const requirementCriteria: RequirementCriterion[] = [
  {
    key: "industry",
    label: "行业",
    description: "客户所在行业或细分市场。",
    question: "你们主要服务哪个行业或细分市场？",
    required: true
  },
  {
    key: "companySize",
    label: "公司规模",
    description: "公司人数、团队规模或服务客户规模。",
    question: "大概可以了解一下你们公司或使用团队的规模吗？",
    required: true
  },
  {
    key: "corePainPoints",
    label: "核心痛点",
    description: "当前最想解决的业务问题。",
    question: "现在最影响效率或增长的 1-3 个核心问题是什么？",
    required: true
  },
  {
    key: "compellingEvent",
    label: "购买触发事件",
    description:
      "为什么是现在要解决：续费压力、新学期、政策变化、业务扩张、成本上升、投诉增加等紧迫触发。",
    question: "是什么让你们现在开始认真考虑更换或引入新系统？",
    required: true
  },
  {
    key: "currentWorkflow",
    label: "当前流程",
    description: "客户现在如何完成相关工作，包括已在使用的 App、表格、人工流程或临时替代方法。",
    question: "你们现在通常怎么处理这件事？可以简单描述现有流程。",
    required: true
  },
  {
    key: "specificWorkflow",
    label: "具体使用链路",
    description:
      "更细的真实场景链路，例如老师是在课堂实时记录学生表现，还是课后回忆再补录；谁创建、谁查看、谁反馈。",
    question: "能不能举一个最近发生的具体场景，从开始到结束通常怎么操作？",
    required: true
  },
  {
    key: "targetUsers",
    label: "目标用户",
    description: "系统的主要使用者或受影响角色。",
    question: "这个方案主要会给哪些角色或团队使用？",
    required: true
  },
  {
    key: "authority",
    label: "决策权",
    description:
      "使用者、影响者、审批者和买单者分别是谁；例如老师使用，但校长、教务主任或总部采购买单。",
    question: "实际使用的人和最终批准或买单的人通常是同一批人吗？",
    required: true
  },
  {
    key: "alternativeSolution",
    label: "竞品/替代方案",
    description:
      "如果不买本产品，客户会继续用什么：现有 App、表格、人工流程、竞品或不处理；最好提取具体名称和不满意点。",
    question: "如果暂时不换新系统，你们会继续用什么办法或哪个工具来解决？",
    required: true
  },
  {
    key: "platformPreference",
    label: "终端与平台偏好",
    description: "使用者偏好的终端和平台：手机 App、平板、电脑网页、微信/企业微信、钉钉等。",
    question: "老师或一线用户更希望在手机、平板，还是电脑网页上使用？",
    required: false
  },
  {
    key: "mustHaveFeatures",
    label: "必须具备特性",
    description: "没有这些功能客户就很难采用的核心能力，用于约束 MVP 范围。",
    question: "如果第一版只能做少数功能，哪些是必须有的？",
    required: true
  },
  {
    key: "niceToHaveFeatures",
    label: "锦上添花特性",
    description: "有价值但不是第一版成交或试点必需的功能。",
    question: "还有哪些功能是有了更好，但第一版没有也可以接受的？",
    required: false
  },
  {
    key: "budgetRange",
    label: "预算范围",
    description: "采购或试点预算区间。",
    question: "你们对试点或正式采购有没有大致预算范围？",
    required: true
  },
  {
    key: "timeline",
    label: "预期时间",
    description: "期望上线、试点或决策时间。",
    question: "你们希望在什么时间点看到试点或上线结果？",
    required: true
  },
  {
    key: "successMetrics",
    label: "成功指标",
    description: "判断项目成功的业务指标。",
    question: "如果项目成功，最希望哪些指标发生改善？",
    required: true
  },
  {
    key: "integrations",
    label: "系统集成",
    description: "需要连接的 CRM、ERP、工单、数据平台或内部系统。",
    question: "需要和哪些现有系统或数据源打通？",
    required: false
  },
  {
    key: "stakeholders",
    label: "关键干系人",
    description: "采购、业务、技术、安全或法务等参与方。",
    question: "后续评估和决策通常会涉及哪些团队或负责人？",
    required: false
  },
  {
    key: "constraints",
    label: "限制条件",
    description: "合规、安全、技术、资源或组织限制。",
    question: "有没有必须遵守的合规、安全、技术或资源限制？",
    required: false
  },
  {
    key: "dataSensitivity",
    label: "数据敏感度",
    description: "数据是否涉及隐私、财务、医疗、受监管信息等。",
    question: "这个场景会处理敏感数据或受监管数据吗？",
    required: false
  },
  {
    key: "decisionProcess",
    label: "决策流程",
    description: "采购、试点、审批或签约路径。",
    question: "从评估到采购或上线，一般需要经过哪些步骤？",
    required: false
  },
  {
    key: "additionalContext",
    label: "补充背景",
    description: "其他对方案设计重要的信息。",
    question: "还有什么背景信息会影响方案设计或优先级？",
    required: false
  }
];
