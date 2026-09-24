export const RAG_SOURCE_DOCUMENT = "02_SkillUp_RAG_Deep_Course_Knowledge.md" as const;

export const RAG_KNOWLEDGE_CLASSES = [
  "business_locked",
  "demo_explanatory",
  "tbd",
] as const;

export type RagKnowledgeClass = (typeof RAG_KNOWLEDGE_CLASSES)[number];

export type RagCourse =
  | "data_analytics"
  | "digital_marketing"
  | "accounting"
  | "all"
  | null;

export type RagChunk = Readonly<{
  chunkId: string;
  title: string;
  content: string;
  course: RagCourse;
  category: string | null;
  intents: readonly string[];
  knowledgeClasses: readonly RagKnowledgeClass[];
  studentFacing: boolean;
  sourceDocument: typeof RAG_SOURCE_DOCUMENT;
  sourceSection: string;
  metadata: Readonly<{
    headingPath: readonly string[];
    sourceSectionId: string | null;
    tags: readonly string[];
  }>;
  normalRetrievalEligible: boolean;
}>;

export type ParsedRagSection = Readonly<{
  level: 1 | 2 | 3;
  title: string;
  contentLines: readonly string[];
  children: readonly ParsedRagSection[];
}>;

export type ParsedRagDocument = Readonly<{
  sections: readonly ParsedRagSection[];
}>;
