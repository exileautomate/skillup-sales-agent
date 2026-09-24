import type { ResolvedLanguage } from "../language/language-resolver.ts";
import type { QueryRoute, QueryToolRequest } from "../routing/types.ts";
import type { SemanticNormalizationResult } from "../types/semantic-normalization.ts";
import type { TurnAnalysis } from "../types/turn-analysis.ts";
import type { ConversationState } from "../state/conversation-state.ts";
import type { SalesDecision } from "../sales-logic/sales-types.ts";
import type {
  Branch,
  Conversation,
  Course,
  Lead,
} from "../../lib/db/repositories/types.ts";

export type SourceLoad<T> =
  | Readonly<{
      status: "not_required";
      data: null;
    }>
  | Readonly<{
      status: "loaded";
      data: T;
    }>
  | Readonly<{
      status: "unresolved";
      data: null;
      reason: string;
    }>
  | Readonly<{
      status: "deferred";
      data: null;
      reason: string;
    }>;

export type DeferredRagSource =
  | Readonly<{
      status: "not_required";
      data: null;
    }>
  | Readonly<{
      status: "deferred";
      data: null;
      reason: "rag_retrieval_not_implemented";
    }>;

export type DeferredToolSource =
  | Readonly<{
      status: "not_required";
      requests: readonly [];
    }>
  | Readonly<{
      status: "deferred";
      requests: readonly QueryToolRequest[];
      reason: "tool_execution_not_implemented";
    }>;

export type CourseBranchMappingEvidence = Readonly<{
  courseId: string;
  courseInternalName: string;
  requestedBranchName: string | null;
  activeBranches: readonly Readonly<Branch>[];
}>;

export type OrchestrationSources = Readonly<{
  structuredCourseFacts: SourceLoad<Readonly<Course>>;
  structuredBranchFacts: SourceLoad<readonly Readonly<Branch>[]>;
  courseBranchMapping: SourceLoad<CourseBranchMappingEvidence>;
  memorySource: SourceLoad<Readonly<Lead>>;
  stateSource: SourceLoad<ConversationState>;
  rag: DeferredRagSource;
  tools: DeferredToolSource;
}>;

export type OrchestrationHandoff = Readonly<{
  lead: Readonly<Lead>;
  conversation: Readonly<Conversation>;
  semanticNormalization: SemanticNormalizationResult;
  turnAnalysis: TurnAnalysis;
  resolvedLanguage: ResolvedLanguage;
  queryRoute: QueryRoute;
  sources: OrchestrationSources;
  salesDecision: SalesDecision;
}>;
