// Outline request status types matching the database enum
export type OutlineRequestStatus =
  | 'submitted'
  | 'validating_outline'
  | 'generating_lessons'
  | 'validating_lessons'
  | 'completed'
  | 'error';

// Lesson status types matching the database enum
export type LessonStatus = 'generated' | 'validating' | 'ready_to_use' | 'error';

// Outline request database record
export interface OutlineRequest {
  id: string;
  title: string | null;
  outline: string;
  status: OutlineRequestStatus;
  error: { message: string; errors?: string[] } | null; // JSONB error data
  created_at: string;
  updated_at: string;
}

// Lesson database record
export interface Lesson {
  id: string;
  status: LessonStatus;
  created_at: string;
  updated_at: string;
}

// Mapping table record
export interface MappingOutlineRequestLesson {
  id: string;
  outline_request_id: string;
  lesson_id: string;
  created_at: string;
}

// Validation result (simple valid/errors structure used by pipeline)
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// NOTE: For actual lesson content structure, use types from lesson-structure.types.ts
// This file only contains DB record types and simple validation results
