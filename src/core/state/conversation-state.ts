import {
  updateConversation,
} from "../../lib/db/repositories/conversations.ts";
import { getCourseByInternalName } from "../../lib/db/repositories/courses.ts";
import type {
  Conversation,
  JsonValue,
} from "../../lib/db/repositories/types.ts";
import type { SemanticNormalizationResult } from "../types/semantic-normalization.ts";
import type { TurnAnalysis } from "../types/turn-analysis.ts";

export const CONVERSATION_STATE_FIELDS = [
  "current_course_id",
  "current_sales_stage",
  "qualification_status",
  "demo_push_status",
  "demo_rejection_count",
  "pending_question",
  "booking_progress_json",
  "confidence_state_json",
] as const;

export type ConversationStateField =
  (typeof CONVERSATION_STATE_FIELDS)[number];

export type ConversationState = Readonly<{
  currentCourseId: Conversation["current_course_id"];
  currentSalesStage: Conversation["current_sales_stage"];
  qualificationStatus: Conversation["qualification_status"];
  demoPushStatus: Conversation["demo_push_status"];
  demoRejectionCount: Conversation["demo_rejection_count"];
  pendingQuestion: Conversation["pending_question"];
  bookingProgress: Conversation["booking_progress_json"];
  confidenceState: Conversation["confidence_state_json"];
}>;

export type ConversationStateUpdatePatch = Readonly<
  Partial<Pick<Conversation, ConversationStateField>>
>;

export type ConversationStateUpdateResult = Readonly<{
  conversation: Readonly<Conversation>;
  changedFields: readonly ConversationStateField[];
}>;

export type ConversationStateDependencies = Readonly<{
  getCourseByInternalName: typeof getCourseByInternalName;
  updateConversation: typeof updateConversation;
}>;

const defaultDependencies: ConversationStateDependencies = {
  getCourseByInternalName,
  updateConversation,
};

/** Maps one persisted Conversation row into the M25 workflow-state contract. */
export function getConversationState(
  conversation: Readonly<Conversation>,
): ConversationState {
  return {
    currentCourseId: conversation.current_course_id,
    currentSalesStage: conversation.current_sales_stage,
    qualificationStatus: conversation.qualification_status,
    demoPushStatus: conversation.demo_push_status,
    demoRejectionCount: conversation.demo_rejection_count,
    pendingQuestion: conversation.pending_question,
    bookingProgress: conversation.booking_progress_json,
    confidenceState: conversation.confidence_state_json,
  };
}

function jsonValuesEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonValuesEqual(value, right[index]))
    );
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        jsonValuesEqual(left[key], right[key]),
    )
  );
}

function stateFieldValuesEqual(
  field: ConversationStateField,
  existing: Conversation[ConversationStateField],
  next: Conversation[ConversationStateField],
): boolean {
  return field === "booking_progress_json" || field === "confidence_state_json"
    ? jsonValuesEqual(existing as JsonValue, next as JsonValue)
    : Object.is(existing, next);
}

/**
 * Removes unapproved and unchanged properties from a supplied state patch.
 * It deliberately does not create sales, qualification, demo, booking, or
 * confidence decisions.
 */
export function deriveConversationStateUpdate(
  conversation: Readonly<Conversation>,
  patch: ConversationStateUpdatePatch,
): Readonly<{
  patch: ConversationStateUpdatePatch;
  changedFields: readonly ConversationStateField[];
}> {
  const changedPatch: Partial<Pick<Conversation, ConversationStateField>> = {};
  const changedFields: ConversationStateField[] = [];

  for (const field of CONVERSATION_STATE_FIELDS) {
    const nextValue = patch[field];

    if (
      nextValue !== undefined &&
      !stateFieldValuesEqual(field, conversation[field], nextValue)
    ) {
      Object.assign(changedPatch, { [field]: nextValue });
      changedFields.push(field);
    }
  }

  return { patch: changedPatch, changedFields };
}

/** Performs at most one approved Conversation state write for a supplied patch. */
export async function persistConversationStatePatch(
  conversation: Readonly<Conversation>,
  patch: ConversationStateUpdatePatch,
  dependencies: Pick<ConversationStateDependencies, "updateConversation"> =
    defaultDependencies,
): Promise<ConversationStateUpdateResult> {
  const decision = deriveConversationStateUpdate(conversation, patch);

  if (decision.changedFields.length === 0) {
    return { conversation, changedFields: [] };
  }

  const updatedConversation = await dependencies.updateConversation(
    conversation.id,
    decision.patch,
  );

  return {
    conversation: updatedConversation,
    changedFields: decision.changedFields,
  };
}

function hasExactlyOneExplicitCourseEntity(
  semanticNormalization: Readonly<SemanticNormalizationResult>,
): boolean {
  return (
    semanticNormalization.preservedEntities.filter(
      (entity) => entity.type === "course",
    ).length === 1
  );
}

/**
 * Establishes only an initial current course from one explicit current-turn
 * course entity and a canonical trusted TurnAnalysis course. Course switching
 * remains outside M25.
 */
export async function applyConversationState(
  input: Readonly<{
    conversation: Readonly<Conversation>;
    semanticNormalization: Readonly<SemanticNormalizationResult>;
    turnAnalysis: Readonly<TurnAnalysis>;
  }>,
  dependencies: ConversationStateDependencies = defaultDependencies,
): Promise<ConversationStateUpdateResult> {
  if (
    input.conversation.current_course_id !== null ||
    input.turnAnalysis.course === null ||
    !hasExactlyOneExplicitCourseEntity(input.semanticNormalization)
  ) {
    return { conversation: input.conversation, changedFields: [] };
  }

  const course = await dependencies.getCourseByInternalName(
    input.turnAnalysis.course,
  );

  if (course === null) {
    return { conversation: input.conversation, changedFields: [] };
  }

  return persistConversationStatePatch(
    input.conversation,
    { current_course_id: course.id },
    dependencies,
  );
}
