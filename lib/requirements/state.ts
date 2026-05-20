import {
  requirementCriteria,
  requirementPatchSchema,
  requirementStateSchema,
  type RequirementCriterion,
  type RequirementKey,
  type RequirementPatch,
  type RequirementState
} from "@/lib/requirements/schema";

export function createEmptyRequirementState(): RequirementState {
  return {
    industry: null,
    companySize: null,
    corePainPoints: null,
    currentWorkflow: null,
    targetUsers: null,
    budgetRange: null,
    timeline: null,
    successMetrics: null,
    integrations: null,
    stakeholders: null,
    constraints: null,
    dataSensitivity: null,
    decisionProcess: null,
    additionalContext: null
  };
}

export function parseRequirementState(input: unknown): RequirementState {
  const parsed = requirementStateSchema.safeParse(input);
  return parsed.success ? parsed.data : createEmptyRequirementState();
}

export function mergeRequirementPatch(
  currentState: RequirementState,
  patch: RequirementPatch
): RequirementState {
  const current = requirementStateSchema.parse(currentState);
  const safePatch = requirementPatchSchema.parse(patch);
  const next: RequirementState = { ...current };

  for (const key of Object.keys(safePatch) as RequirementKey[]) {
    const value = safePatch[key];

    if (typeof value === "undefined") {
      continue;
    }

    Object.assign(next, { [key]: value });
  }

  return requirementStateSchema.parse(next);
}

export function isMissingValue(value: RequirementState[RequirementKey]): boolean {
  if (value === null || typeof value === "undefined") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return typeof value === "string" && value.trim().length === 0;
}

export function getMissingCriteria(state: RequirementState): RequirementCriterion[] {
  return requirementCriteria.filter(
    (criterion) => criterion.required && isMissingValue(state[criterion.key])
  );
}

export function getFilledCriteria(state: RequirementState): RequirementCriterion[] {
  return requirementCriteria.filter((criterion) => !isMissingValue(state[criterion.key]));
}

export function calculateCompleteness(state: RequirementState): number {
  const requiredCriteria = requirementCriteria.filter((criterion) => criterion.required);
  const missing = getMissingCriteria(state);

  if (requiredCriteria.length === 0) {
    return 1;
  }

  return (requiredCriteria.length - missing.length) / requiredCriteria.length;
}

export type RequirementDiff = {
  key: RequirementKey;
  label: string;
  action: "created" | "updated" | "cleared";
  previousValue: RequirementState[RequirementKey];
  nextValue: RequirementState[RequirementKey];
};

export function diffRequirementStates(
  previous: RequirementState,
  next: RequirementState
): RequirementDiff[] {
  return requirementCriteria.flatMap((criterion) => {
    const previousValue = previous[criterion.key];
    const nextValue = next[criterion.key];

    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) {
      return [];
    }

    const wasMissing = isMissingValue(previousValue);
    const isMissing = isMissingValue(nextValue);

    return [
      {
        key: criterion.key,
        label: criterion.label,
        action: isMissing ? "cleared" : wasMissing ? "created" : "updated",
        previousValue,
        nextValue
      }
    ];
  });
}

export function formatRequirementValue(value: RequirementState[RequirementKey]): string {
  if (isMissingValue(value)) {
    return "未确认";
  }

  if (Array.isArray(value)) {
    return value.join("；");
  }

  return String(value);
}

export function formatRequirementStateForPrompt(state: RequirementState): string {
  return requirementCriteria
    .map((criterion) => {
      const requiredLabel = criterion.required ? "required" : "optional";
      return `- ${criterion.label} (${criterion.key}, ${requiredLabel}): ${formatRequirementValue(
        state[criterion.key]
      )}`;
    })
    .join("\n");
}

export function buildFallbackQuestion(state: RequirementState): string {
  const [nextMissing] = getMissingCriteria(state);

  if (nextMissing) {
    return nextMissing.question;
  }

  return "我已经收集到核心信息了。你还有什么需要补充或修正的吗？";
}
