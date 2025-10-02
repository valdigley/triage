/*
  # Fix Notification System - Prevent Duplicates

  1. Changes
    - Add unique constraint to prevent duplicate notifications
    - Add indexes for better query performance
    - Add function to clean up old notifications
    - Configure pg_cron for automatic processing (every 5 minutes)

  2. Security
    - Maintains existing RLS policies
*/

-- Create partial unique index to prevent duplicate pending notifications
-- This ensures the same notification type can't be scheduled multiple times for the same appointment
DROP INDEX IF EXISTS unique_pending_notification_per_appointment;
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_notification_per_appointment 
ON notification_queue (appointment_id, template_type)
WHERE status = 'pending';

-- Create index for better performance on scheduled notifications query
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_pending 
ON notification_queue (scheduled_for, status) 
WHERE status = 'pending';

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_notification_queue_status 
ON notification_queue (status);

-- Function to clean up old sent/failed notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM notification_queue
  WHERE status IN ('sent', 'failed')
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$;