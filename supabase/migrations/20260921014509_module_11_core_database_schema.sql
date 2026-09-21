-- Phase 2 / Module 11: Core database schema only.
-- Intentionally excludes seed data, messages, RLS policies, and runtime behavior.

create extension if not exists vector with schema extensions;

create type public.lead_status as enum (
  'NEW',
  'QUALIFYING',
  'QUALIFIED',
  'NURTURE',
  'UNQUALIFIED'
);

create type public.sales_stage as enum (
  'NEW',
  'DISCOVERY',
  'COURSE_EDUCATION',
  'QUALIFICATION',
  'OBJECTION',
  'DEMO_READY',
  'BOOKING',
  'BOOKED',
  'NURTURE',
  'STOPPED'
);

create type public.qualification_status as enum (
  'UNKNOWN',
  'PENDING',
  'QUALIFIED',
  'UNQUALIFIED'
);

create type public.demo_push_status as enum (
  'NORMAL',
  'NURTURE',
  'STOP_DEMO_PUSH',
  'STOP_ALL_SALES_PUSH'
);

create type public.booking_status as enum (
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'FAILED'
);

create type public.knowledge_class as enum (
  'business_locked',
  'demo_explanatory',
  'tbd'
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  internal_name text not null unique,
  student_facing_name text not null,
  slug text not null unique,
  duration_months integer check (duration_months >= 0),
  learning_months integer check (learning_months >= 0),
  internship_months integer check (internship_months >= 0),
  base_fee numeric(12, 2) check (base_fee >= 0),
  gst_percentage numeric(5, 2) check (gst_percentage >= 0),
  fee_including_gst numeric(12, 2) check (fee_including_gst >= 0),
  admission_fee numeric(12, 2) check (admission_fee >= 0),
  total_fee numeric(12, 2) check (total_fee >= 0),
  eligibility_summary text,
  installment_rules_json jsonb,
  class_duration_minutes integer check (class_duration_minutes >= 0),
  batch_start_rule text,
  certificate_summary text,
  placement_assistance boolean,
  laptop_required boolean,
  demo_available boolean,
  course_status text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  google_maps_url text,
  wifi boolean,
  parking boolean,
  computer_lab boolean,
  ac_classroom boolean,
  boys_hostel_available boolean,
  boys_hostel_fee numeric(12, 2) check (boys_hostel_fee >= 0),
  boys_hostel_food text,
  boys_hostel_distance text,
  boys_hostel_room_type text,
  girls_hostel_available boolean,
  girls_hostel_fee numeric(12, 2) check (girls_hostel_fee >= 0),
  girls_hostel_food text,
  girls_hostel_distance text,
  girls_hostel_room_type text,
  other_facilities_json jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.course_branches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  branch_id uuid not null references public.branches(id),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (course_id, branch_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  channel_user_id text not null,
  name text,
  phone text,
  preferred_language text,
  qualification text,
  current_course_interest_id uuid references public.courses(id) on delete set null,
  branch_preference_id uuid references public.branches(id) on delete set null,
  lead_status public.lead_status not null default 'NEW',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (channel, channel_user_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  channel text not null,
  status text,
  current_course_id uuid references public.courses(id) on delete set null,
  current_sales_stage public.sales_stage not null default 'NEW',
  qualification_status public.qualification_status not null default 'UNKNOWN',
  confidence_state_json jsonb,
  demo_push_status public.demo_push_status not null default 'NORMAL',
  demo_rejection_count integer not null default 0 check (demo_rejection_count >= 0),
  pending_question text,
  booking_progress_json jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.demo_bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  conversation_id uuid not null references public.conversations(id),
  course_id uuid not null references public.courses(id),
  branch_id uuid not null references public.branches(id),
  student_name text not null,
  contact text not null,
  booking_date date not null,
  booking_time time without time zone not null,
  status public.booking_status not null default 'PENDING',
  tool_reference text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  category text not null,
  intent text,
  title text not null,
  content text not null,
  knowledge_class public.knowledge_class not null,
  student_facing boolean not null,
  metadata_json jsonb,
  embedding extensions.vector,
  source_document text,
  source_section text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index idx_course_branches_branch_id on public.course_branches(branch_id);
create index idx_leads_current_course_interest_id on public.leads(current_course_interest_id);
create index idx_leads_branch_preference_id on public.leads(branch_preference_id);
create index idx_conversations_lead_id on public.conversations(lead_id);
create index idx_conversations_current_course_id on public.conversations(current_course_id);
create index idx_demo_bookings_lead_id on public.demo_bookings(lead_id);
create index idx_demo_bookings_conversation_id on public.demo_bookings(conversation_id);
create index idx_demo_bookings_course_id on public.demo_bookings(course_id);
create index idx_demo_bookings_branch_id on public.demo_bookings(branch_id);
create index idx_knowledge_base_course_id on public.knowledge_base(course_id);
create index idx_knowledge_base_category_intent on public.knowledge_base(category, intent);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create trigger set_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

create trigger set_course_branches_updated_at
before update on public.course_branches
for each row execute function public.set_updated_at();

create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create trigger set_demo_bookings_updated_at
before update on public.demo_bookings
for each row execute function public.set_updated_at();

create trigger set_knowledge_base_updated_at
before update on public.knowledge_base
for each row execute function public.set_updated_at();
