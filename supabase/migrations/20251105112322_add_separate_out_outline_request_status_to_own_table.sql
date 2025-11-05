-- Alter outline_request table to move status and error to a new table
ALTER TABLE outline_request DROP COLUMN IF EXISTS status;
ALTER TABLE outline_request DROP COLUMN IF EXISTS error;

-- new status values
DROP TYPE IF EXISTS outline_request_status;

CREATE TYPE outline_request_status AS ENUM (
  'submitted',
  'outline.validating',
  'outline.validated',
  'outline.blocks.generating',
  'outline.blocks.generated',
  'lessons.generating',
  'lessons.generated',
  'lessons.validating',
  'lessons.validated',
  'completed',
  'error',
  'failed'
);


-- Alter outline_request table to move status and error to a new table
ALTER TABLE outline_request DROP COLUMN IF EXISTS status;
ALTER TABLE outline_request DROP COLUMN IF EXISTS error;

ALTER TABLE outline_request ADD COLUMN IF NOT EXISTS content_blocks JSONB;

-- Create outline_request_status_record table
CREATE TABLE IF NOT EXISTS outline_request_status_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_request_id UUID NOT NULL REFERENCES outline_request(id) ON DELETE CASCADE,
  status outline_request_status NOT NULL DEFAULT 'submitted',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outline_request_status_record_outline_request_id ON outline_request_status_record(outline_request_id);
CREATE INDEX IF NOT EXISTS idx_outline_request_status_record_status ON outline_request_status_record(status);
CREATE INDEX IF NOT EXISTS idx_outline_request_status_record_created_at ON outline_request_status_record(created_at DESC);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE outline_request_status_record ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outline_request_status_record (no auth required)
CREATE POLICY "Anyone can view outline_request_status_record"
  ON outline_request_status_record FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create outline_request_status_record"
  ON outline_request_status_record FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update outline_request_status_record"
  ON outline_request_status_record FOR UPDATE
  USING (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE outline_request_status_record;
