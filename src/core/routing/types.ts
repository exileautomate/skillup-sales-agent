export type QueryToolRequest =
  | Readonly<{
      tool: "check_demo_availability";
    }>
  | Readonly<{
      tool: "get_course_document";
      documentType: "brochure" | "syllabus" | "testimonial";
    }>
  | Readonly<{
      tool: "get_branch_location";
    }>;

export type QueryRoute = Readonly<{
  needsStructuredCourseFacts: boolean;
  needsBranchFacts: boolean;
  needsRag: boolean;
  needsMemory: boolean;
  needsState: boolean;
  toolRequests: readonly QueryToolRequest[];
}>;
