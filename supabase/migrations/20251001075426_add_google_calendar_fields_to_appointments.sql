/*
  # Add Google Calendar fields to appointments

  1. Changes
    - Add `google_calendar_event_id` column to store Google Calendar event ID
    - Add `google_calendar_event_link` column to store event link
    - Add `google_calendar_synced` boolean to track sync status
  
  2. Notes
    - These fields enable tracking of Google Calendar integration
    - Allows appointments to link to their calendar events
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'google_calendar_event_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN google_calendar_event_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'google_calendar_event_link'
  ) THEN
    ALTER TABLE appointments ADD COLUMN google_calendar_event_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'google_calendar_synced'
  ) THEN
    ALTER TABLE appointments ADD COLUMN google_calendar_synced boolean DEFAULT false;
  END IF;
END $$;
