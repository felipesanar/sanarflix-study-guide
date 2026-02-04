-- Remove time fields from calendar_subjects (day-only calendar)
-- This aligns schema with the current calendar UX that does not use time slots.

ALTER TABLE public.calendar_subjects
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time;