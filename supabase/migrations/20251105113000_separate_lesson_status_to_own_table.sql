-- Alter lesson table to move status and error to a new table
ALTER TABLE lesson DROP COLUMN IF EXISTS status;
ALTER TABLE lesson DROP COLUMN IF EXISTS error;

-- new status values
DROP TYPE IF EXISTS lesson_status;

CREATE TYPE lesson_status AS ENUM (
  'lesson.generated',
  'lesson.validating',
  'lesson.ready_to_use',
  'error',
  'completed',
  'failed'
);

-- Create lesson_status_record table
CREATE TABLE IF NOT EXISTS lesson_status_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
  status lesson_status NOT NULL DEFAULT 'lesson.generated',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_status_record_lesson_id ON lesson_status_record(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_status_record_status ON lesson_status_record(status);
CREATE INDEX IF NOT EXISTS idx_lesson_status_record_created_at ON lesson_status_record(created_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE lesson_status_record ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lesson_status_record (no auth required)
CREATE POLICY "Anyone can view lesson_status_record"
  ON lesson_status_record FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create lesson_status_record"
  ON lesson_status_record FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update lesson_status_record"
  ON lesson_status_record FOR UPDATE
  USING (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE lesson_status_record;
