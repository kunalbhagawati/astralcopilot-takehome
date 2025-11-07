-- Create outline_request table with consolidated status tracking
-- Status is tracked via timestamp columns, not enum values
CREATE TABLE IF NOT EXISTS outline_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  outline TEXT NOT NULL,
  content_blocks JSONB,
  num_lessons INTEGER,

  -- Status timestamp columns
  submitted_at TIMESTAMP WITH TIME ZONE,
  outline_validating_at TIMESTAMP WITH TIME ZONE,
  outline_validated_at TIMESTAMP WITH TIME ZONE,
  outline_blocks_generating_at TIMESTAMP WITH TIME ZONE,
  outline_blocks_generated_at TIMESTAMP WITH TIME ZONE,
  error_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,

  -- Status metadata columns (separate JSONB per status)
  outline_validating_metadata JSONB,
  outline_validated_metadata JSONB,
  outline_blocks_generating_metadata JSONB,
  outline_blocks_generated_metadata JSONB,
  error_metadata JSONB,
  failed_metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lesson table with consolidated status tracking
CREATE TABLE IF NOT EXISTS lesson (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_request_id UUID NOT NULL REFERENCES outline_request(id) ON DELETE CASCADE,
  title TEXT,
  generated_code text NOT NULL,
  generated_file_path TEXT,
  compiled_code text,
  compiled_file_path TEXT,
  validation_attempts INTEGER DEFAULT 0,

  -- Status timestamp columns
  lesson_generated_at TIMESTAMP WITH TIME ZONE,
  lesson_validating_at TIMESTAMP WITH TIME ZONE,
  lesson_compiled_at TIMESTAMP WITH TIME ZONE,
  error_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,

  -- Status metadata columns (separate JSONB per status)
  lesson_generated_metadata JSONB,
  lesson_validating_metadata JSONB,
  lesson_compiled_metadata JSONB,
  error_metadata JSONB,
  failed_metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outline_request_created_at ON outline_request(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outline_request_submitted_at ON outline_request(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_outline_request_outline_blocks_generated_at ON outline_request(outline_blocks_generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_outline_request_id ON lesson(outline_request_id);
CREATE INDEX IF NOT EXISTS idx_lesson_created_at ON lesson(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_generated_at ON lesson(lesson_generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_compiled_at ON lesson(lesson_compiled_at DESC);

-- Create triggers for updated_at on both tables
CREATE TRIGGER update_outline_request_updated_at
  BEFORE UPDATE ON outline_request
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lesson_updated_at
  BEFORE UPDATE ON lesson
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE outline_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outline_request (no auth required)
CREATE POLICY "Anyone can view outline_requests"
  ON outline_request FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create outline_requests"
  ON outline_request FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update outline_requests"
  ON outline_request FOR UPDATE
  USING (true);

-- RLS Policies for lesson (no auth required)
CREATE POLICY "Anyone can view lessons"
  ON lesson FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create lessons"
  ON lesson FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update lessons"
  ON lesson FOR UPDATE
  USING (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE outline_request;
ALTER PUBLICATION supabase_realtime ADD TABLE lesson;
