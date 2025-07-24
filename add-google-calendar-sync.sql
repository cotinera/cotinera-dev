-- Add google_event_id to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Create google_calendar_sync table
CREATE TABLE IF NOT EXISTS google_calendar_sync (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  sync_token TEXT,
  webhook_channel_id TEXT,
  webhook_resource_id TEXT,
  webhook_expiration TIMESTAMP,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_sync_trip_id ON google_calendar_sync(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_google_event_id ON activities(google_event_id);