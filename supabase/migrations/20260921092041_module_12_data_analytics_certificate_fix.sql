-- Phase 2 / Module 12: restore the approved Data Analytics certificate fact only.

update public.courses
set certificate_summary = 'SkillUp course-completion / BIDA certificate'
where internal_name = 'data_analytics';
