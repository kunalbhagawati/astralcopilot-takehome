// Re-export database types as type aliases
// Source of truth: lib/types/database.types.ts (auto-generated from Supabase)
import type { Tables } from './database.types';

// Status type definitions
// These are TypeScript unions that match the timestamp columns used for status tracking
// Status is derived from which timestamp columns are non-null, not stored as enum values
export type OutlineRequestStatus =
  | 'submitted'
  | 'outline.validating'
  | 'outline.validated'
  | 'outline.blocks.generating'
  | 'outline.blocks.generated'
  | 'error'
  | 'failed';

export type LessonStatus = 'lesson.generated' | 'lesson.validating' | 'lesson.compiled' | 'error' | 'failed';

// Database table type aliases
// These are direct aliases to ensure type safety and match database schema exactly
export type OutlineRequest = Tables<'outline_request'>;
export type Lesson = Tables<'lesson'>;
