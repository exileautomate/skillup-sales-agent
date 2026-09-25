import {
  RAG_SOURCE_DOCUMENT,
  type ParsedRagDocument,
  type ParsedRagSection,
  type RagChunk,
  type RagCourse,
  type RagKnowledgeClass,
} from "./types.ts";

type MutableSection = {
  level: 1 | 2 | 3;
  title: string;
  contentLines: string[];
  children: MutableSection[];
};

const MAX_GUIDANCE_WORDS = 700;
const KNOWLEDGE_CLASS_ORDER: readonly RagKnowledgeClass[] = [
  "business_locked",
  "demo_explanatory",
  "tbd",
];

const TAG_RULES: readonly Readonly<{ match: RegExp; tag: string }>[] = [
  { match: /excel/i, tag: "excel" },
  { match: /sql/i, tag: "sql" },
  { match: /python/i, tag: "python" },
  { match: /power bi/i, tag: "power_bi" },
  { match: /tableau/i, tag: "tableau" },
  { match: /dashboard/i, tag: "dashboard" },
  { match: /coding/i, tag: "coding" },
  { match: /seo/i, tag: "seo" },
  { match: /google ads/i, tag: "google_ads" },
  { match: /meta ads/i, tag: "meta_ads" },
  { match: /social media/i, tag: "social_media" },
  { match: /content marketing/i, tag: "content_marketing" },
  { match: /email marketing/i, tag: "email_marketing" },
  { match: /e-?commerce/i, tag: "ecommerce" },
  { match: /analytics/i, tag: "marketing_analytics" },
  { match: /campaign/i, tag: "campaigns" },
  { match: /freelancing/i, tag: "freelancing" },
  { match: /general ledger/i, tag: "general_ledger" },
  { match: /accounts payable/i, tag: "accounts_payable" },
  { match: /accounts receivable/i, tag: "accounts_receivable" },
  { match: /asset accounting/i, tag: "asset_accounting" },
  { match: /gst/i, tag: "gst" },
  { match: /taxation/i, tag: "taxation" },
  { match: /financial reporting/i, tag: "financial_reporting" },
  { match: /cost\s*\/\s*controlling|cost control/i, tag: "cost_control" },
  { match: /internship/i, tag: "internship" },
  { match: /placement/i, tag: "placement" },
  { match: /salary/i, tag: "salary" },
  { match: /fee|payment/i, tag: "fee_explanation" },
  { match: /objection/i, tag: "objection" },
  { match: /hostel/i, tag: "hostel" },
  { match: /branch|facilit/i, tag: "facilities" },
  { match: /demo/i, tag: "demo" },
  { match: /admission/i, tag: "admission" },
  { match: /mentor|support/i, tag: "support" },
  { match: /parent/i, tag: "parent_question" },
  { match: /practical|project|assignment/i, tag: "practical_training" },
];

function toReadonlySection(section: MutableSection): ParsedRagSection {
  return {
    level: section.level,
    title: section.title,
    contentLines: [...section.contentLines],
    children: section.children.map(toReadonlySection),
  };
}

/** Parses only Markdown heading structure; source text is retained verbatim. */
export function parseRagMarkdown(markdown: string): ParsedRagDocument {
  const root: MutableSection = { level: 0 as 1, title: "", contentLines: [], children: [] };
  const stack: MutableSection[] = [root];

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      const level = heading[1].length as 1 | 2 | 3;
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const section: MutableSection = {
        level,
        title: heading[2],
        contentLines: [],
        children: [],
      };
      stack[stack.length - 1].children.push(section);
      stack.push(section);
    } else {
      stack[stack.length - 1].contentLines.push(line);
    }
  }

  return { sections: root.children.map(toReadonlySection) };
}

/** Counts visible non-whitespace tokens deterministically for inspection only. */
export function countRagWords(content: string): number {
  const words = content.trim().match(/\S+/g);
  return words === null ? 0 : words.length;
}

function sourceSectionId(path: readonly string[]): string | null {
  for (const title of [...path].reverse()) {
    const match = /\b((?:DA|DM|AC|CMP|FEE|OBJ)-\d{2})\b/.exec(title);
    if (match !== null) {
      return match[1];
    }
  }
  return null;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function classesDeclaredIn(content: string): RagKnowledgeClass[] {
  const lower = content.toLowerCase();
  const classes: RagKnowledgeClass[] = [];
  if (/\*\*(knowledge class|demo-explanatory)/i.test(content) && lower.includes("business-locked")) {
    classes.push("business_locked");
  }
  if (/\*\*(knowledge class|demo-explanatory)/i.test(content) && lower.includes("demo-explanatory")) {
    classes.push("demo_explanatory");
  }
  if (/\*\*knowledge class/i.test(content) && /tbd\s*\/\s*client confirmation/i.test(content)) {
    classes.push("tbd");
  }
  return classes;
}

function combinedClasses(pathContent: readonly string[], path: readonly string[]): RagKnowledgeClass[] {
  const found = new Set<RagKnowledgeClass>();
  for (const content of pathContent) {
    for (const knowledgeClass of classesDeclaredIn(content)) {
      found.add(knowledgeClass);
    }
  }
  if (path.some((title) => /current known gaps/i.test(title))) {
    found.add("tbd");
  }
  return KNOWLEDGE_CLASS_ORDER.filter((knowledgeClass) => found.has(knowledgeClass));
}

function inferCourse(path: readonly string[]): RagCourse {
  const headings = path.join(" ");
  if (/\bCMP-\d{2}\b|course comparison/i.test(headings)) {
    return "all";
  }
  if (/\bDA-\d{2}\b|course deep dive\s*[—-]\s*data analytics|data analytics payment/i.test(headings)) {
    return "data_analytics";
  }
  if (/\bDM-\d{2}\b|course deep dive\s*[—-]\s*digital marketing|digital marketing payment/i.test(headings)) {
    return "digital_marketing";
  }
  if (/\bAC-\d{2}\b|course deep dive\s*[—-]\s*accounting|accounting payment/i.test(headings)) {
    return "accounting";
  }
  return null;
}

function inferCategory(path: readonly string[]): string | null {
  const headings = path.join(" ");
  if (/\b(?:DA|DM|AC)-\d{2}\b/.test(headings)) return "course_topic";
  if (/\bCMP-\d{2}\b|course comparison/i.test(headings)) return "course_comparison";
  if (/\bFEE-\d{2}\b|fee and payment/i.test(headings)) return "fee_explanation";
  if (/\bOBJ-\d{2}\b|common objection/i.test(headings)) return "objection";
  if (/placement/i.test(headings)) return "placement";
  if (/internship/i.test(headings)) return "internship";
  if (/mentor support/i.test(headings)) return "support";
  if (/branch and facility/i.test(headings)) return "facilities";
  if (/hostel/i.test(headings)) return "hostel";
  if (/demo knowledge/i.test(headings)) return "demo";
  if (/parent-facing/i.test(headings)) return "parent_question";
  if (/salary/i.test(headings)) return "salary";
  return null;
}

function tagsFor(path: readonly string[], course: RagCourse, category: string | null): string[] {
  const tags = new Set<string>();
  if (course !== null && course !== "all") tags.add(course);
  if (category !== null && category !== "course_topic" && category !== "course_comparison") {
    tags.add(category);
  }
  const headings = path.join(" ");
  for (const rule of TAG_RULES) {
    if (rule.match.test(headings)) tags.add(rule.tag);
  }
  return [...tags];
}

function isStudentFacing(path: readonly string[], classes: readonly RagKnowledgeClass[]): boolean {
  if (classes.includes("tbd")) return false;
  const headings = path.join(" ");
  return !/how this rag document|knowledge labels|student-facing naming rules|rag retrieval intents|recommended rag chunking|retrieval rules|must not override|writing style|verification guidance|demo-only content boundary|quick course retrieval summary|final rag doctrine/i.test(headings);
}

function meaningfulOwnContent(section: ParsedRagSection): string {
  const content = section.contentLines.join("\n").trim();
  const withoutStructure = content
    .replace(/^---$/gm, "")
    .replace(/^\*\*(?:Knowledge class|Demo-explanatory)[^\n]*\*\*$/gim, "")
    .trim();
  return withoutStructure === "" ? "" : content;
}

function flattenedContent(section: ParsedRagSection): string {
  const own = section.contentLines.join("\n").trim();
  const childContent = section.children
    .map((child) => `\n\n${"#".repeat(child.level)} ${child.title}\n\n${flattenedContent(child)}`)
    .join("");
  return `${own}${childContent}`.trim();
}

function splitLongNaturalContent(heading: string, content: string): string[] {
  const whole = `${heading}\n\n${content}`.trim();
  if (countRagWords(whole) <= MAX_GUIDANCE_WORDS) return [whole];

  const parts: string[] = [];
  let current: string[] = [];
  for (const paragraph of content.split(/\n\s*\n/)) {
    const candidate = [...current, paragraph].join("\n\n");
    if (current.length > 0 && countRagWords(`${heading}\n\n${candidate}`) > MAX_GUIDANCE_WORDS) {
      parts.push(`${heading}\n\n${current.join("\n\n")}`.trim());
      current = [paragraph];
    } else {
      current.push(paragraph);
    }
  }
  if (current.length > 0) parts.push(`${heading}\n\n${current.join("\n\n")}`.trim());
  return parts;
}

function buildChunk(
  content: string,
  path: readonly string[],
  inheritedContent: readonly string[],
  part: number,
  partCount: number,
): RagChunk {
  const sectionId = sourceSectionId(path);
  const classes = combinedClasses(inheritedContent, path);
  const course = inferCourse(path);
  const category = inferCategory(path);
  const tags = tagsFor(path, course, category);
  const leafHasSectionId = sectionId !== null && path[path.length - 1].includes(sectionId);
  const identity = sectionId === null
    ? slug(path.join("-"))
    : leafHasSectionId
      ? slug(sectionId)
      : slug(`${sectionId}-${path[path.length - 1]}`);
  return {
    chunkId: `skillup-rag-v1-${identity}${partCount > 1 ? `-part-${part}` : ""}`,
    title: path[path.length - 1],
    content,
    course,
    category,
    intents: [...tags],
    knowledgeClasses: [...classes],
    studentFacing: isStudentFacing(path, classes),
    sourceDocument: RAG_SOURCE_DOCUMENT,
    sourceSection: sectionId ?? path[path.length - 1],
    metadata: {
      headingPath: [...path],
      sourceSectionId: sectionId,
      tags: [...tags],
    },
    normalRetrievalEligible: !classes.includes("tbd"),
  };
}

function chunksForSection(
  section: ParsedRagSection,
  parentPath: readonly string[],
  ancestorContent: readonly string[],
): RagChunk[] {
  const path = [...parentPath, section.title];
  const ownContent = meaningfulOwnContent(section);
  const fullContent = flattenedContent(section);
  const inheritedContent = [...ancestorContent, section.contentLines.join("\n")];

  if (section.children.length === 0) {
    if (ownContent === "") return [];
    const parts = splitLongNaturalContent(`${"#".repeat(section.level)} ${section.title}`, ownContent);
    return parts.map((part, index) => buildChunk(part, path, inheritedContent, index + 1, parts.length));
  }

  if (
    section.level > 1 &&
    countRagWords(`${"#".repeat(section.level)} ${section.title}\n\n${fullContent}`) <= MAX_GUIDANCE_WORDS &&
    ownContent !== ""
  ) {
    return [buildChunk(
      `${"#".repeat(section.level)} ${section.title}\n\n${fullContent}`.trim(),
      path,
      inheritedContent,
      1,
      1,
    )];
  }

  const ownChunks = ownContent === ""
    ? []
    : splitLongNaturalContent(`${"#".repeat(section.level)} ${section.title}`, ownContent)
      .map((part, index, parts) => buildChunk(part, path, inheritedContent, index + 1, parts.length));
  return [...ownChunks, ...section.children.flatMap((child) =>
    chunksForSection(child, path, inheritedContent),
  )];
}

/** Produces deterministic, storage-ready chunks without filesystem, provider, or database I/O. */
export function ingestSkillUpRagDocument(markdown: string): RagChunk[] {
  const parsed = parseRagMarkdown(markdown);
  const occurrences = new Map<string, number>();
  const chunks = parsed.sections.flatMap((section) => chunksForSection(section, [], [])).map((chunk) => {
    const occurrence = (occurrences.get(chunk.chunkId) ?? 0) + 1;
    occurrences.set(chunk.chunkId, occurrence);
    return occurrence === 1
      ? chunk
      : { ...chunk, chunkId: `${chunk.chunkId}-part-${occurrence}` };
  });

  return chunks.filter((chunk) => chunk.knowledgeClasses.some((knowledgeClass) =>
    KNOWLEDGE_CLASS_ORDER.includes(knowledgeClass),
  ));
}
