export type Uuid = string;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type LeadStatus =
  | "NEW"
  | "QUALIFYING"
  | "QUALIFIED"
  | "NURTURE"
  | "UNQUALIFIED";

export type SalesStage =
  | "NEW"
  | "DISCOVERY"
  | "COURSE_EDUCATION"
  | "QUALIFICATION"
  | "OBJECTION"
  | "DEMO_READY"
  | "BOOKING"
  | "BOOKED"
  | "NURTURE"
  | "STOPPED";

export type QualificationStatus =
  | "UNKNOWN"
  | "PENDING"
  | "QUALIFIED"
  | "UNQUALIFIED";

export type DemoPushStatus =
  | "NORMAL"
  | "NURTURE"
  | "STOP_DEMO_PUSH"
  | "STOP_ALL_SALES_PUSH";

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED";

export type KnowledgeClass = "business_locked" | "demo_explanatory" | "tbd";

export type Course = {
  id: Uuid;
  internal_name: string;
  student_facing_name: string;
  slug: string;
  duration_months: number | null;
  learning_months: number | null;
  internship_months: number | null;
  base_fee: number | null;
  gst_percentage: number | null;
  fee_including_gst: number | null;
  admission_fee: number | null;
  total_fee: number | null;
  eligibility_summary: string | null;
  installment_rules_json: JsonValue;
  class_duration_minutes: number | null;
  batch_start_rule: string | null;
  certificate_summary: string | null;
  placement_assistance: boolean | null;
  laptop_required: boolean | null;
  demo_available: boolean | null;
  course_status: string | null;
  created_at: string;
  updated_at: string;
};

export type Branch = {
  id: Uuid;
  name: string;
  address: string | null;
  google_maps_url: string | null;
  wifi: boolean | null;
  parking: boolean | null;
  computer_lab: boolean | null;
  ac_classroom: boolean | null;
  boys_hostel_available: boolean | null;
  boys_hostel_fee: number | null;
  boys_hostel_food: string | null;
  boys_hostel_distance: string | null;
  boys_hostel_room_type: string | null;
  girls_hostel_available: boolean | null;
  girls_hostel_fee: number | null;
  girls_hostel_food: string | null;
  girls_hostel_distance: string | null;
  girls_hostel_room_type: string | null;
  other_facilities_json: JsonValue;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: Uuid;
  channel: string;
  channel_user_id: string;
  name: string | null;
  phone: string | null;
  preferred_language: string | null;
  qualification: string | null;
  current_course_interest_id: Uuid | null;
  branch_preference_id: Uuid | null;
  lead_status: LeadStatus;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: Uuid;
  lead_id: Uuid;
  channel: string;
  status: string | null;
  current_course_id: Uuid | null;
  current_sales_stage: SalesStage;
  qualification_status: QualificationStatus;
  confidence_state_json: JsonValue;
  demo_push_status: DemoPushStatus;
  demo_rejection_count: number;
  pending_question: string | null;
  booking_progress_json: JsonValue;
  created_at: string;
  updated_at: string;
};

export type DemoBooking = {
  id: Uuid;
  lead_id: Uuid;
  conversation_id: Uuid;
  course_id: Uuid;
  branch_id: Uuid;
  student_name: string;
  contact: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  tool_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeBaseRecord = {
  id: Uuid;
  source_chunk_id: string;
  course_id: Uuid | null;
  category: string | null;
  intent: string | null;
  title: string;
  content: string;
  knowledge_class: KnowledgeClass;
  student_facing: boolean;
  metadata_json: JsonValue;
  embedding: string | null;
  source_document: string | null;
  source_section: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateLeadInput = {
  channel: string;
  channel_user_id: string;
  name?: string | null;
  phone?: string | null;
  preferred_language?: string | null;
  qualification?: string | null;
  current_course_interest_id?: Uuid | null;
  branch_preference_id?: Uuid | null;
  lead_status?: LeadStatus;
};

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, "channel" | "channel_user_id">>;

export type CreateConversationInput = {
  lead_id: Uuid;
  channel: string;
  status?: string | null;
  current_course_id?: Uuid | null;
  current_sales_stage?: SalesStage;
  qualification_status?: QualificationStatus;
  confidence_state_json?: JsonValue;
  demo_push_status?: DemoPushStatus;
  demo_rejection_count?: number;
  pending_question?: string | null;
  booking_progress_json?: JsonValue;
};

export type UpdateConversationInput = Partial<
  Omit<Conversation, "id" | "created_at" | "updated_at">
>;

export type CreateDemoBookingInput = {
  lead_id: Uuid;
  conversation_id: Uuid;
  course_id: Uuid;
  branch_id: Uuid;
  student_name: string;
  contact: string;
  booking_date: string;
  booking_time: string;
  status?: BookingStatus;
  tool_reference?: string | null;
};

export type UpdateDemoBookingInput = Partial<
  Omit<DemoBooking, "id" | "created_at" | "updated_at">
>;

export type KnowledgeBaseFilters = {
  course_id?: Uuid;
  category?: string;
  intent?: string;
  knowledge_class?: KnowledgeClass;
  student_facing?: boolean;
};

export type UpsertKnowledgeBaseRecordInput = {
  source_chunk_id: string;
  course_id: Uuid | null;
  category: string | null;
  intent: string | null;
  title: string;
  content: string;
  knowledge_class: KnowledgeClass;
  student_facing: boolean;
  metadata_json: JsonValue;
  embedding: string | null;
  source_document: string;
  source_section: string;
};
