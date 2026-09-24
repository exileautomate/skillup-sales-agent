import type { NormalizedTextInboundMessage } from "../input/types.ts";
import {
  RESPONSE_LANGUAGES,
  resolveLanguage,
  type LanguageResolverInput,
  type ResolvedLanguage,
} from "../language/language-resolver.ts";
import { applyLeadMemory } from "../memory/lead-memory.ts";
import {
  applyConversationState,
  getConversationState,
} from "../state/conversation-state.ts";
import { routeQuery } from "../routing/query-router.ts";
import type { QueryRoute, QueryToolRequest } from "../routing/types.ts";
import {
  TURN_ANALYSIS_COURSES,
  type TurnAnalysis,
  type TurnAnalysisInput,
  type TurnCourse,
} from "../types/turn-analysis.ts";
import {
  getActiveBranchesForCourse,
  getBranchByName,
  listBranches,
} from "../../lib/db/repositories/branches.ts";
import {
  getCourseById,
  getCourseByInternalName,
} from "../../lib/db/repositories/courses.ts";
import { updateLead } from "../../lib/db/repositories/leads.ts";
import { updateConversation } from "../../lib/db/repositories/conversations.ts";
import type {
  Branch,
  Conversation,
  Course,
  Lead,
} from "../../lib/db/repositories/types.ts";
import { normalizeSemanticMeaning } from "../../services/openai/semantic-normalizer.ts";
import { analyzeTurn } from "../../services/openai/turn-analysis.ts";
import type {
  CourseBranchMappingEvidence,
  DeferredRagSource,
  DeferredToolSource,
  OrchestrationHandoff,
  OrchestrationSources,
  SourceLoad,
} from "./types.ts";

export type OrchestrateTextTurnDependencies = Readonly<{
  normalizeSemanticMeaning?: typeof normalizeSemanticMeaning;
  analyzeTurn?: typeof analyzeTurn;
  applyLeadMemory?: typeof applyLeadMemory;
  applyConversationState?: typeof applyConversationState;
  resolveLanguage?: typeof resolveLanguage;
  routeQuery?: typeof routeQuery;
  getCourseById?: typeof getCourseById;
  getCourseByInternalName?: typeof getCourseByInternalName;
  getBranchByName?: typeof getBranchByName;
  getActiveBranchesForCourse?: typeof getActiveBranchesForCourse;
  listBranches?: typeof listBranches;
  updateLead?: typeof updateLead;
  updateConversation?: typeof updateConversation;
}>;

export type OrchestrateTextTurnInput = Readonly<{
  message: NormalizedTextInboundMessage;
  lead: Readonly<Lead>;
  conversation: Readonly<Conversation>;
}>;

type ResolvedDependencies = Required<OrchestrateTextTurnDependencies>;

const DEMO_DEFAULT_LANGUAGE: ResolvedLanguage = "manglish";
const SHORT_NEUTRAL_ACKNOWLEDGEMENTS = new Set(["ok", "yes", "fine", "hmm"]);

const defaultDependencies: ResolvedDependencies = {
  normalizeSemanticMeaning,
  analyzeTurn,
  applyLeadMemory,
  applyConversationState,
  resolveLanguage,
  routeQuery,
  getCourseById,
  getCourseByInternalName,
  getBranchByName,
  getActiveBranchesForCourse,
  listBranches,
  updateLead,
  updateConversation,
};

function resolveDependencies(
  dependencies: OrchestrateTextTurnDependencies,
): ResolvedDependencies {
  return { ...defaultDependencies, ...dependencies };
}

function isResolvedLanguage(value: string | null): value is ResolvedLanguage {
  return (
    value !== null &&
    (RESPONSE_LANGUAGES as readonly string[]).includes(value)
  );
}

function isTurnCourse(value: string): value is TurnCourse {
  return (TURN_ANALYSIS_COURSES as readonly string[]).includes(value);
}

export function shouldInheritCurrentLanguageContext(text: string): boolean {
  return SHORT_NEUTRAL_ACKNOWLEDGEMENTS.has(text.trim().toLowerCase());
}

function buildLeadContext(
  lead: Readonly<Lead>,
): Readonly<Record<string, unknown>> | undefined {
  const context: Record<string, unknown> = {};

  if (lead.name !== null) {
    context.name = lead.name;
  }

  if (lead.qualification !== null) {
    context.qualification = lead.qualification;
  }

  if (isResolvedLanguage(lead.preferred_language)) {
    context.preferredLanguage = lead.preferred_language;
  }

  return Object.keys(context).length === 0 ? undefined : context;
}

async function loadExistingConversationCourse(
  conversation: Readonly<Conversation>,
  dependencies: ResolvedDependencies,
): Promise<Readonly<Course> | null> {
  if (conversation.current_course_id === null) {
    return null;
  }

  const course = await dependencies.getCourseById(
    conversation.current_course_id,
  );

  if (course === null || !isTurnCourse(course.internal_name)) {
    return null;
  }

  return course;
}

function buildTurnAnalysisInput(
  message: NormalizedTextInboundMessage,
  normalizedEnglish: string,
  lead: Readonly<Lead>,
  existingConversationCourse: Readonly<Course> | null,
): TurnAnalysisInput {
  const currentConversationState =
    existingConversationCourse === null
      ? undefined
      : { currentCourse: existingConversationCourse.internal_name };
  const leadMemory = buildLeadContext(lead);

  return {
    originalMessage: message.text,
    normalizedEnglish,
    ...(currentConversationState === undefined
      ? {}
      : { currentConversationState }),
    ...(leadMemory === undefined ? {} : { leadMemory }),
    recentConversation: null,
  };
}

async function resolveCanonicalCourseRecord(
  course: TurnCourse,
  existingConversationCourse: Readonly<Course> | null,
  dependencies: ResolvedDependencies,
): Promise<Readonly<Course> | null> {
  if (existingConversationCourse?.internal_name === course) {
    return existingConversationCourse;
  }

  return dependencies.getCourseByInternalName(course);
}

async function loadStructuredCourseFacts(
  queryRoute: QueryRoute,
  turnAnalysis: TurnAnalysis,
  existingConversationCourse: Readonly<Course> | null,
  dependencies: ResolvedDependencies,
): Promise<SourceLoad<Readonly<Course>>> {
  if (!queryRoute.needsStructuredCourseFacts) {
    return { status: "not_required", data: null };
  }

  if (turnAnalysis.course === null) {
    return {
      status: "unresolved",
      data: null,
      reason: "canonical_course_unavailable",
    };
  }

  const course = await resolveCanonicalCourseRecord(
    turnAnalysis.course,
    existingConversationCourse,
    dependencies,
  );

  if (course === null) {
    return {
      status: "unresolved",
      data: null,
      reason: "course_record_not_found",
    };
  }

  return { status: "loaded", data: course };
}

type BranchSourceLoads = Readonly<{
  structuredBranchFacts: SourceLoad<readonly Readonly<Branch>[]>;
  courseBranchMapping: SourceLoad<CourseBranchMappingEvidence>;
}>;

async function loadStructuredBranchSources(
  queryRoute: QueryRoute,
  turnAnalysis: TurnAnalysis,
  existingConversationCourse: Readonly<Course> | null,
  structuredCourseFacts: SourceLoad<Readonly<Course>>,
  dependencies: ResolvedDependencies,
): Promise<BranchSourceLoads> {
  if (!queryRoute.needsBranchFacts) {
    return {
      structuredBranchFacts: { status: "not_required", data: null },
      courseBranchMapping: { status: "not_required", data: null },
    };
  }

  const namedBranch = turnAnalysis.leadFacts.branchPreference?.trim();

  if (turnAnalysis.course !== null) {
    const course =
      structuredCourseFacts.status === "loaded"
        ? structuredCourseFacts.data
        : await resolveCanonicalCourseRecord(
            turnAnalysis.course,
            existingConversationCourse,
            dependencies,
          );

    if (course === null) {
      const structuredBranchFacts = namedBranch
        ? await loadNamedBranch(namedBranch, dependencies)
        : {
            status: "unresolved" as const,
            data: null,
            reason: "course_for_branch_mapping_not_found",
          };

      return {
        structuredBranchFacts,
        courseBranchMapping: {
          status: "unresolved",
          data: null,
          reason: "course_for_branch_mapping_not_found",
        },
      };
    }

    const activeBranches = await dependencies.getActiveBranchesForCourse(course.id);
    const courseBranchMapping: SourceLoad<CourseBranchMappingEvidence> = {
      status: "loaded",
      data: {
        courseId: course.id,
        courseInternalName: course.internal_name,
        requestedBranchName: namedBranch ?? null,
        activeBranches,
      },
    };

    return {
      structuredBranchFacts: namedBranch
        ? await loadNamedBranch(namedBranch, dependencies)
        : { status: "loaded", data: activeBranches },
      courseBranchMapping,
    };
  }

  if (namedBranch) {
    return {
      structuredBranchFacts: await loadNamedBranch(namedBranch, dependencies),
      courseBranchMapping: { status: "not_required", data: null },
    };
  }

  const branches = await dependencies.listBranches();
  return {
    structuredBranchFacts: { status: "loaded", data: branches },
    courseBranchMapping: { status: "not_required", data: null },
  };
}

async function loadNamedBranch(
  namedBranch: string,
  dependencies: ResolvedDependencies,
): Promise<SourceLoad<readonly Readonly<Branch>[]>> {
  const branch = await dependencies.getBranchByName(namedBranch);

  if (branch === null) {
    return {
      status: "unresolved",
      data: null,
      reason: "named_branch_not_found",
    };
  }

  return { status: "loaded", data: [branch] };
}

function buildRagSource(queryRoute: QueryRoute): DeferredRagSource {
  return queryRoute.needsRag
    ? {
        status: "deferred",
        data: null,
        reason: "rag_retrieval_not_implemented",
      }
    : { status: "not_required", data: null };
}

function copyToolRequest(request: QueryToolRequest): QueryToolRequest {
  return request.tool === "get_course_document"
    ? { tool: request.tool, documentType: request.documentType }
    : { tool: request.tool };
}

function buildToolSource(queryRoute: QueryRoute): DeferredToolSource {
  if (queryRoute.toolRequests.length === 0) {
    return { status: "not_required", requests: [] };
  }

  return {
    status: "deferred",
    requests: queryRoute.toolRequests.map(copyToolRequest),
    reason: "tool_execution_not_implemented",
  };
}

async function loadSources(
  lead: Readonly<Lead>,
  conversationState: ReturnType<typeof getConversationState>,
  turnAnalysis: TurnAnalysis,
  queryRoute: QueryRoute,
  existingConversationCourse: Readonly<Course> | null,
  dependencies: ResolvedDependencies,
): Promise<OrchestrationSources> {
  const structuredCourseFacts = await loadStructuredCourseFacts(
    queryRoute,
    turnAnalysis,
    existingConversationCourse,
    dependencies,
  );
  const branchSources = await loadStructuredBranchSources(
    queryRoute,
    turnAnalysis,
    existingConversationCourse,
    structuredCourseFacts,
    dependencies,
  );

  return {
    structuredCourseFacts,
    structuredBranchFacts: branchSources.structuredBranchFacts,
    courseBranchMapping: branchSources.courseBranchMapping,
    memorySource: queryRoute.needsMemory
      ? { status: "loaded", data: lead }
      : { status: "not_required", data: null },
    stateSource: queryRoute.needsState
      ? { status: "loaded", data: conversationState }
      : { status: "not_required", data: null },
    rag: buildRagSource(queryRoute),
    tools: buildToolSource(queryRoute),
  };
}

export async function orchestrateTextTurn(
  input: OrchestrateTextTurnInput,
  dependencies: OrchestrateTextTurnDependencies = {},
): Promise<OrchestrationHandoff> {
  const resolved = resolveDependencies(dependencies);
  const semanticNormalization = await resolved.normalizeSemanticMeaning(
    input.message.text,
  );
  const existingConversationCourse = await loadExistingConversationCourse(
    input.conversation,
    resolved,
  );
  const turnAnalysisInput = buildTurnAnalysisInput(
    input.message,
    semanticNormalization.normalizedEnglish,
    input.lead,
    existingConversationCourse,
  );
  const turnAnalysis = await resolved.analyzeTurn(turnAnalysisInput);
  const leadMemoryResult = await resolved.applyLeadMemory(
    {
      lead: input.lead,
      semanticNormalization,
      turnAnalysis,
    },
    {
      getBranchByName: resolved.getBranchByName,
      getCourseByInternalName: resolved.getCourseByInternalName,
      updateLead: resolved.updateLead,
    },
  );
  const currentLead = leadMemoryResult.lead;
  const conversationStateResult = await resolved.applyConversationState(
    {
      conversation: input.conversation,
      semanticNormalization,
      turnAnalysis,
    },
    {
      getCourseByInternalName: resolved.getCourseByInternalName,
      updateConversation: resolved.updateConversation,
    },
  );
  const currentConversation = conversationStateResult.conversation;
  const currentConversationState = getConversationState(currentConversation);
  const languageResolverInput: LanguageResolverInput = {
    requestedResponseLanguage: turnAnalysis.requestedResponseLanguage,
    currentDetectedLanguage: semanticNormalization.detectedOriginalLanguage,
    recentLanguage: null,
    storedPreferredLanguage: isResolvedLanguage(currentLead.preferred_language)
      ? currentLead.preferred_language
      : null,
    defaultLanguage: DEMO_DEFAULT_LANGUAGE,
    inheritCurrentLanguageContext: shouldInheritCurrentLanguageContext(
      input.message.text,
    ),
  };
  const resolvedLanguage = resolved.resolveLanguage(languageResolverInput);
  const queryRoute = resolved.routeQuery(turnAnalysis);
  const sources = await loadSources(
    currentLead,
    currentConversationState,
    turnAnalysis,
    queryRoute,
    existingConversationCourse,
    resolved,
  );

  return {
    lead: currentLead,
    conversation: currentConversation,
    semanticNormalization,
    turnAnalysis,
    resolvedLanguage,
    queryRoute,
    sources,
  };
}
