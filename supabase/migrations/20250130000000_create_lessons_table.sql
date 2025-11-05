-- Create enum types for status fields
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

CREATE TYPE lesson_status AS ENUM (
  'lesson.generating',
  'lesson.generated',
  'lesson.validating',
  'lesson.compiling',
  'error',
  'completed',
  'failed'
);

-- Create outline_request table
CREATE TABLE IF NOT EXISTS outline_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  outline TEXT NOT NULL,
  content_blocks JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create outline_request_status_record table
CREATE TABLE IF NOT EXISTS outline_request_status_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_request_id UUID NOT NULL REFERENCES outline_request(id) ON DELETE CASCADE,
  status outline_request_status NOT NULL DEFAULT 'submitted',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Create lesson table
CREATE TABLE IF NOT EXISTS lesson (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  generated_code JSONB NOT NULL,
  compiled_code JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Create mapping table to link outline_request and lesson
CREATE TABLE IF NOT EXISTS mapping_outline_request_lesson (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_request_id UUID NOT NULL REFERENCES outline_request(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(outline_request_id, lesson_id)
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

CREATE INDEX IF NOT EXISTS idx_lesson_created_at ON lesson(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mapping_outline_request_id ON mapping_outline_request_lesson(outline_request_id);
CREATE INDEX IF NOT EXISTS idx_mapping_lesson_id ON mapping_outline_request_lesson(lesson_id);

CREATE INDEX IF NOT EXISTS idx_outline_request_status_record_outline_request_id ON outline_request_status_record(outline_request_id);
CREATE INDEX IF NOT EXISTS idx_outline_request_status_record_status ON outline_request_status_record(status);
CREATE INDEX IF NOT EXISTS idx_outline_request_status_record_created_at ON outline_request_status_record(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_status_record_lesson_id ON lesson_status_record(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_status_record_status ON lesson_status_record(status);
CREATE INDEX IF NOT EXISTS idx_lesson_status_record_created_at ON lesson_status_record(created_at DESC);

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
ALTER TABLE mapping_outline_request_lesson ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_status_record ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for mapping table (no auth required)
CREATE POLICY "Anyone can view mappings"
  ON mapping_outline_request_lesson FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create mappings"
  ON mapping_outline_request_lesson FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete mappings"
  ON mapping_outline_request_lesson FOR DELETE
  USING (true);

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
ALTER PUBLICATION supabase_realtime ADD TABLE outline_request;
ALTER PUBLICATION supabase_realtime ADD TABLE lesson;
ALTER PUBLICATION supabase_realtime ADD TABLE mapping_outline_request_lesson;
ALTER PUBLICATION supabase_realtime ADD TABLE outline_request_status_record;
ALTER PUBLICATION supabase_realtime ADD TABLE lesson_status_record;
