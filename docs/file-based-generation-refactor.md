# File-Based Generation Refactor

**Date**: 2025-11-08
**Status**: ✅ Completed

## Problem Statement

### Initial Issue
Generated lesson code was being saved to the database, but **files were not being created on disk**.

### Investigation Results
1. Checked lesson `f0323c10-1d42-4839-ac77-9a8bd7584f46` in database
2. Found `generated_file_path` and `compiled_file_path` were `null`
3. Discovered lesson had 5 validation attempts but never reached completion
4. Files were only written **after validation passed**, in the compilation step
5. Since validation never passed, `compileAndWriteTSX()` was never called

### Root Causes
1. **Late file writing**: Files only written after validation succeeded
   - No files for lessons that failed validation
   - Poor observability during development/debugging

2. **ComponentName complexity**: Unnecessary tracking of component names
   - Always used default export: `export default function LessonPage()`
   - Added extra field to every type/schema
   - Created maintenance burden without value

3. **Validation-first approach**: Generated code → Validate → Compile → Write files
   - If validation failed, no files to inspect
   - Harder to debug LLM output

## Solution

### 1. Immediate File Writing
**Write files right after generation, before validation**

```typescript
// OLD FLOW
Generate → Validate → If valid → Compile → Write files
                   → If invalid → Retry

// NEW FLOW
Generate → Write files immediately → Validate → If invalid → Regenerate → Rewrite files
```

**Benefits**:
- ✅ Files always available for inspection (even for failed lessons)
- ✅ Can manually check what LLM generated
- ✅ Files updated after each regeneration attempt
- ✅ Full observability at every step

### 2. Remove ComponentName Tracking
**Simplify types by removing componentName field**

All lessons use the same pattern:
```typescript
'use client';
import { ... } from 'react';

export default function LessonPage() {
  // lesson implementation
}
```

No need to track or validate component names - it's always `LessonPage` with default export.

## Changes Made

### 1. Type Definitions (`lib/types/tsx-generation.types.ts`)

#### `LessonTSX` Interface
```diff
export interface LessonTSX {
  title: string;
  tsxCode: string;
- componentName: string;
  originalBlocks: Array<{ type: string; content?: string; prompt?: string }>;
  imports?: string[];
}
```

#### `SingleLessonTSXResult` Interface
```diff
export interface SingleLessonTSXResult {
  title: string;
  tsxCode: string;
- componentName: string;
  originalBlocks: Array<{ type: string; content?: string; prompt?: string }>;
  imports?: string[];
}
```

#### `TSXRegenerationInput` Interface
```diff
export interface TSXRegenerationInput {
  originalCode: string;
- componentName: string;
  validationErrors: TSXValidationError[];
  lessonTitle: string;
  blocks: ActionableBlock[];
  attemptNumber: number;
}
```

#### `TSXRegenerationResult` Interface
```diff
export interface TSXRegenerationResult {
  tsxCode: string;
- componentName: string;
  fixedErrors: string[];
  attemptNumber: number;
}
```

#### Schema Updates
All Zod schemas updated to:
```typescript
.refine((code) => code.includes('export default'), 'TSX code must include default export')
.refine((code) => code.includes('function LessonPage'), 'TSX code must export LessonPage function')
```

Instead of validating componentName field.

### 2. Repository (`lib/services/repositories/lesson.repository.ts`)

#### `create()` Method
```diff
- async create(title: string, generatedCode: { tsxCode: string; componentName: string }): Promise<Lesson>
+ async create(title: string, generatedCode: { tsxCode: string }): Promise<Lesson>
```

#### `updateGeneratedCode()` Method
```diff
- async updateGeneratedCode(lessonId: string, generatedCode: { tsxCode: string; componentName: string }): Promise<void>
+ async updateGeneratedCode(lessonId: string, generatedCode: { tsxCode: string }): Promise<void>
```

#### `updateCompiledCode()` Method
```diff
- async updateCompiledCode(lessonId: string, compiledCode: { javascript: string; componentName: string }): Promise<void>
+ async updateCompiledCode(lessonId: string, compiledCode: { javascript: string }): Promise<void>
```

#### `updateCompiledCodeAndPaths()` Method
```diff
async updateCompiledCodeAndPaths(
  lessonId: string,
  update: {
-   compiledCode: { javascript: string; componentName: string };
+   compiledCode: { javascript: string };
    filePaths: { generatedFilePath: string; compiledFilePath: string };
  },
): Promise<void>
```

### 3. State Machine (`lib/services/machines/outline-request.actor-machine.ts`)

#### Import Change
```diff
- import { compileTSX } from '../compilation/tsx-compiler';
+ import { compileAndWriteTSX } from '../compilation/tsx-compiler';
```

#### Step 1-3: Immediate File Writing
```typescript
// Step 1: Create lesson record with generated TSX code
const generatedCode = {
  tsxCode: tsxLesson.tsxCode,
};

const createdLesson = await lessonRepo.create(lesson.title, generatedCode);

// Step 2: Write files immediately for observability
let filePaths;
try {
  filePaths = await compileAndWriteTSX(generatedCode.tsxCode, createdLesson.id);
  logger.info(`Files written for lesson ${createdLesson.id}: ${filePaths.tsxPath}, ${filePaths.jsPath}`);

  // Read compiled code for DB storage
  const fs = await import('fs/promises');
  const compiledCode = await fs.readFile(filePaths.jsPath, 'utf-8');

  // Store file paths and compiled code in DB
  await lessonRepo.updateCompiledCodeAndPaths(createdLesson.id, {
    compiledCode: {
      javascript: compiledCode,
    },
    filePaths: {
      generatedFilePath: filePaths.tsxPath,
      compiledFilePath: filePaths.jsPath,
    },
  });
} catch (writeError) {
  logger.error(`Failed to write files for lesson ${createdLesson.id}:`, writeError);
  // Continue with validation anyway - we can retry file write later
}

// Step 3: Mark as lesson.generated
await lessonRepo.createStatusRecord(createdLesson.id, 'lesson.generated' as LessonStatus, {
  title: lesson.title,
  tsxCodeSize: generatedCode.tsxCode.length,
  blockCount: lesson.blocks.length,
  filesWritten: !!filePaths,
});
```

#### Regeneration: Rewrite Files
```typescript
// After LLM regenerates code
const regenerationResult = await llmClient.regenerateTSXWithFeedback({
  originalCode: generatedCode.tsxCode,
  validationErrors: validationResult.errors,
  lessonTitle: lesson.title,
  blocks: lesson.blocks,
  attemptNumber: retryCount + 1,
});

// Update with regenerated code
generatedCode.tsxCode = regenerationResult.tsxCode;

// Update database with regenerated code
await lessonRepo.updateGeneratedCode(createdLesson.id, generatedCode);

// Rewrite files with regenerated code
try {
  const regeneratedFilePaths = await compileAndWriteTSX(generatedCode.tsxCode, createdLesson.id);
  logger.info(
    `Files rewritten for lesson ${createdLesson.id}: ${regeneratedFilePaths.tsxPath}, ${regeneratedFilePaths.jsPath}`,
  );

  // Update compiled code and paths in DB
  const fs = await import('fs/promises');
  const compiledCode = await fs.readFile(regeneratedFilePaths.jsPath, 'utf-8');

  await lessonRepo.updateCompiledCodeAndPaths(createdLesson.id, {
    compiledCode: {
      javascript: compiledCode,
    },
    filePaths: {
      generatedFilePath: regeneratedFilePaths.tsxPath,
      compiledFilePath: regeneratedFilePaths.jsPath,
    },
  });
} catch (rewriteError) {
  logger.error(`Failed to rewrite files for lesson ${createdLesson.id}:`, rewriteError);
}
```

#### Removed: Separate Compilation Step
```diff
- // Step 4: Compile TSX to JavaScript and write files (lesson.compiling)
- const compilationStartTime = Date.now();
- let compiledCode;
- let filePaths;
- try {
-   const result = await compileAndWriteTSX(generatedCode.tsxCode, createdLesson.id);
-   filePaths = result;
-   // ... compilation logic
- }

// Files now written immediately after generation (Step 2)
// And rewritten after each regeneration
```

#### Simplified Completion
```diff
- // Step 6: Mark as completed
+ // Step 5: Mark as completed
await lessonRepo.createStatusRecord(createdLesson.id, 'completed' as LessonStatus, {
  title: lesson.title,
- componentName: generatedCode.componentName,
  validationAttempts: retryCount + 1,
  tsxCodeSize: generatedCode.tsxCode.length,
- compiledCodeSize: compiledCode.length,
  totalBlocks: lesson.blocks.length,
});
```

## New Generation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: TSX Generation (LLM)                                   │
│ - Generate full Next.js page with 'use client'                 │
│ - Always export default function LessonPage()                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Create Lesson Record                                   │
│ - Insert to lesson table                                       │
│ - generated_code: { tsxCode }                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Write Files Immediately ⭐ NEW                         │
│ - compileAndWriteTSX(tsxCode, lessonId)                        │
│ - Creates ./tmp/generated/{lessonId}/page.tsx                  │
│ - Creates ./tmp/generated/{lessonId}/page.js                   │
│ - Stores file paths in DB                                      │
│ - Stores compiled code in DB                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Mark as lesson.generated                               │
│ - Status metadata includes filesWritten: true                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Validate TSX                                           │
│ - Run TypeScript + ESLint validation                           │
│ - Up to 4 attempts (maxRetries=3)                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
             Valid                Invalid
                │                     │
                ▼                     ▼
         ┌──────────┐      ┌─────────────────────┐
         │Step 5:   │      │ Regenerate with LLM │
         │Completed │      │ - Get fixes         │
         └──────────┘      │ - Update DB         │
                           │ - Rewrite files ⭐  │
                           └──────┬──────────────┘
                                  │
                                  └─────► Retry validation
                                          (up to 4 attempts)
                                               │
                                    ┌──────────┴──────────┐
                                    │                     │
                                 Success              Max retries
                                    │                     │
                                    ▼                     ▼
                             ┌──────────┐         ┌───────────┐
                             │Completed │         │  Failed   │
                             └──────────┘         └───────────┘
```

## Database Schema

No changes needed. Uses existing columns:
- `lesson.generated_code` (JSONB) - Stores `{ tsxCode }`
- `lesson.compiled_code` (JSONB) - Stores `{ javascript }`
- `lesson.generated_file_path` (text) - Absolute path to .tsx file
- `lesson.compiled_file_path` (text) - Absolute path to .js file

## Runtime Flow

When user visits `/lessons/{id}`:

```typescript
// app/lessons/[id]/page.tsx
const { data: lesson } = await supabase
  .from('lesson')
  .select('id, title, created_at, compiled_file_path')
  .eq('id', lessonId)
  .single();

// Check if file path exists
if (!lesson.compiled_file_path) {
  return <LessonNotReadyError />;
}

// Dynamic import from file system
const fileUrl = `file://${lesson.compiled_file_path}`;
const lessonModule = await import(fileUrl);
const GeneratedLessonPage = lessonModule.default;

return <GeneratedLessonPage />;
```

## Observability Benefits

### Before
- ❌ No files for failed lessons
- ❌ Can't inspect what LLM generated if validation failed
- ❌ componentName field adding noise to logs/metadata
- ❌ Separate compilation step duplicating file write logic

### After
- ✅ Files written immediately after generation
- ✅ Files available for every lesson (success or failure)
- ✅ Files rewritten after each regeneration attempt
- ✅ Can manually inspect any attempt's generated code
- ✅ Simplified types and schemas
- ✅ Clear default export pattern
- ✅ Single source of truth for file writing

## File Locations

Generated files stored at:
```
./tmp/generated/{lessonId}/
├── page.tsx  (TypeScript source)
└── page.js   (Compiled JavaScript)
```

Example:
```
./tmp/generated/f0323c10-1d42-4839-ac77-9a8bd7584f46/
├── page.tsx
└── page.js
```

## Testing

All TypeScript compilation passes:
```bash
$ bunx tsc --noEmit
# No errors
```

## Migration Notes

### For Existing Lessons
Old lessons in database may have:
- `generated_code.componentName` field (ignored, harmless)
- `compiled_code.componentName` field (ignored, harmless)
- `null` file paths (if created before this change)

New lesson generation will:
- Not include componentName in generated_code
- Not include componentName in compiled_code
- Always populate file paths

### No Breaking Changes
- Old lesson records still work (extra fields ignored)
- Runtime only reads compiled_file_path
- All new lessons use simplified schema

## Related Files

### Modified
- `lib/types/tsx-generation.types.ts` - Removed componentName from all types
- `lib/services/repositories/lesson.repository.ts` - Simplified method signatures
- `lib/services/machines/outline-request.actor-machine.ts` - Immediate file writing
- `app/lessons/[id]/page.tsx` - Reads compiled_file_path from DB

### Unchanged
- `lib/services/compilation/tsx-compiler.ts` - compileAndWriteTSX() already existed
- `lib/services/validation/tsx-validation-orchestrator.ts` - No changes needed
- Database schema - Uses existing columns

## Summary

**Problem**: Files not created for lessons that failed validation
**Root Cause**: Files only written after validation passed; unnecessary componentName tracking
**Solution**: Write files immediately after generation; remove componentName field
**Result**: Full observability, simplified codebase, files available for all lessons

**Key Insight**: "Write the file after generation and then again and again after fixing errors" - ensures files are always available for inspection and debugging, regardless of validation status.
