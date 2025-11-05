// Re-export database types as type aliases
// Source of truth: lib/types/database.types.ts (auto-generated from Supabase)
import type { Database, Tables } from './database.types';

// Enum type aliases for convenience
export type OutlineRequestStatus = Database['public']['Enums']['outline_request_status'];
export type LessonStatus = Database['public']['Enums']['lesson_status'];

// Database table type aliases
// These are direct aliases to ensure type safety and match database schema exactly
export type OutlineRequest = Tables<'outline_request'>;
export type Lesson = Tables<'lesson'>;
export type MappingOutlineRequestLesson = Tables<'mapping_outline_request_lesson'>;
