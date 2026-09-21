-- Phase 2 / Module 12: approved SkillUp course, branch, and availability seed data only.

insert into public.courses (
  internal_name,
  student_facing_name,
  slug,
  duration_months,
  learning_months,
  internship_months,
  base_fee,
  gst_percentage,
  fee_including_gst,
  admission_fee,
  total_fee,
  eligibility_summary,
  installment_rules_json,
  class_duration_minutes,
  batch_start_rule,
  certificate_summary,
  placement_assistance,
  laptop_required,
  demo_available,
  course_status
)
values
  (
    'data_analytics',
    'Data Analytics',
    'data-analytics',
    9,
    7,
    2,
    38000,
    18,
    44840,
    2000,
    46840,
    'Degree required. Any degree is accepted under the current rule. Plus Two alone is insufficient. No prior programming or Python experience is required.',
    '{"monthly_no_interest_option": true, "two_term_payment_option": true}'::jsonb,
    180,
    '2nd of every month',
    null,
    true,
    true,
    true,
    null
  ),
  (
    'digital_marketing',
    'Digital Marketing',
    'digital-marketing',
    8,
    6,
    2,
    60000,
    18,
    70800,
    2000,
    72800,
    'Plus Two / 12th equivalent accepted. No prior Digital Marketing experience, coding experience, or advanced technical knowledge is required. Basic computer usage/knowledge is expected.',
    '{"seven_installment_option": {"first_installment": 15000, "remaining_amount_split_into_equal_installments": 6, "interest_percentage": 0}, "two_installment_option": true, "admission_fee_separate": true}'::jsonb,
    180,
    '5th of every month',
    null,
    true,
    true,
    true,
    null
  ),
  (
    'accounting',
    'Accounting',
    'accounting',
    10,
    7,
    3,
    40000,
    null,
    47200,
    3000,
    50200,
    'Approved backgrounds: B.Com, BBA, CA, CMA, ACCA, MBA Finance, or accounting work experience. Other equivalent commerce, accounting, or finance backgrounds may require confirmation.',
    '{"first_five_months_percentage": 60, "next_five_months_percentage": 40, "interest_percentage": 0}'::jsonb,
    300,
    'Demo snapshot: next known batch 10 October 2026.',
    'SkillUp course-completion certificate',
    true,
    true,
    false,
    null
  );

insert into public.branches (
  name,
  address,
  google_maps_url,
  wifi,
  parking,
  computer_lab,
  ac_classroom,
  boys_hostel_available,
  boys_hostel_fee,
  boys_hostel_food,
  boys_hostel_distance,
  boys_hostel_room_type,
  girls_hostel_available,
  girls_hostel_fee,
  girls_hostel_food,
  girls_hostel_distance,
  girls_hostel_room_type,
  other_facilities_json
)
values
  ('Calicut', null, null, true, true, null, null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 500 metres', null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 200 metres', null, null),
  ('Mankave', null, null, true, true, null, null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 500 metres', null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 200 metres', null, null),
  ('Kochi', null, null, true, true, null, null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 500 metres', null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 200 metres', null, null),
  ('Kannur', null, null, true, true, null, null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 500 metres', null, true, 10000, 'Available; approximately ₹10,000 extra per month', 'Approximately 200 metres', null, null);

insert into public.course_branches (course_id, branch_id, is_active)
select
  courses.id,
  branches.id,
  true
from (
  values
    ('data_analytics', 'Calicut'),
    ('data_analytics', 'Mankave'),
    ('data_analytics', 'Kochi'),
    ('data_analytics', 'Kannur'),
    ('digital_marketing', 'Calicut'),
    ('digital_marketing', 'Mankave'),
    ('accounting', 'Calicut'),
    ('accounting', 'Mankave'),
    ('accounting', 'Kochi')
) as mapping(internal_name, branch_name)
join public.courses on courses.internal_name = mapping.internal_name
join public.branches on branches.name = mapping.branch_name;
