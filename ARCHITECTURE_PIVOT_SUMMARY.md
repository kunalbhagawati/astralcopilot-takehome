# Architecture Pivot: File-Based Dynamic Imports

**Date**: 2025-11-07
**Status**: ✅ IMPLEMENTED & TESTED

## Problem

The previous component-eval architecture was failing with repeated LLM errors:
- 113+ TypeScript errors per generation
- Template literal escaping issues (`}`}> instead of `}>`)
- Missing imports (CheckCircle, XCircle, etc.)
- Wasting LLM generation cycles on validation failures

## Root Cause

LLM was generating **component code** in isolation with:
- Complex template literal className logic
- JSON escaping within TypeScript strings
- No full page context
- Validation template wrapping adding confusion

## New Architecture: File-Based Full Pages

### Flow

```
LLM → Full Next.js Page → Validate → Compile → Write to Disk → Dynamic Import
```

### Key Changes

1. **LLM generates full pages** (not components)
   - Starts with `'use client';`
   - Uses `export default function LessonPage()`
   - Complete, self-contained Next.js page
   - More context = better generation

2. **No template wrapping**
   - Validate exactly what LLM generates
   - What you validate = what you write to disk
   - No confusion about wrapping/patching

3. **Files written to disk**
   - `./tmp/generated/{lessonId}/page.tsx` (source)
   - `./tmp/generated/{lessonId}/page.js` (compiled)
   - Standard file system, no DB storage

4. **Dynamic imports at runtime**
   - Server Component uses `import(fileUrl)`
   - No eval, no Function constructor
   - Standard Node.js/Next.js pattern

## Files Modified

### Critical Changes

1. ✅ **lib/prompts/tsx-generation.prompts.ts**
   - Generate full pages with `'use client'`
   - Export: `export default function LessonPage()`
   - Updated all examples and instructions

2. ✅ **lib/services/validation/typescript-validator.ts**
   - Removed template wrapping
   - Validate full page as-is

3. ✅ **lib/services/compilation/tsx-compiler.ts**
   - Added `compileAndWriteTSX()` function
   - Creates directory structure
   - Writes both .tsx and .js files

4. ✅ **app/lessons/[id]/page.tsx**
   - Converted to Server Component
   - Uses dynamic import with `file://` protocol
   - No more component renderer/eval

5. ✅ **.gitignore**
   - Added `tmp/generated/` directory

### Test Script

✅ **scripts/test-file-based-generation.ts**
- End-to-end POC test
- Validates, compiles, writes files
- Confirms everything works

## Test Results

```bash
$ NODE_ENV=development bun scripts/test-file-based-generation.ts

✅ Validation passed!
✅ TSX source written: .../test-1762540530606/page.tsx
✅ Compiled JS written: .../test-1762540530606/page.js
✅ TSX file size: 2221 bytes
✅ JS file size: 2077 bytes

✅ SUCCESS! File-based generation working
```

## Benefits Over Previous Approach

| Previous (Component Eval) | New (File-Based) |
|---------------------------|------------------|
| Component only | Full page context |
| Template wrapping | No wrapping |
| Eval with Function() | Dynamic import() |
| DB stores code | Files on disk |
| Complex context passing | Standard imports |
| 113+ errors | Cleaner generation |

## How It Works Now

### Generation (LLM)

```typescript
// LLM generates complete page:
'use client';
import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function LessonPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 py-12 px-4">
      {/* Full page content */}
    </main>
  );
}
```

### Compilation

```typescript
const { tsxPath, jsPath } = await compileAndWriteTSX(
  generatedCode,
  lessonId
);

// Files created:
// ./tmp/generated/{lessonId}/page.tsx
// ./tmp/generated/{lessonId}/page.js
```

### Runtime

```typescript
// app/lessons/[id]/page.tsx (Server Component)
const generatedPagePath = path.join(
  process.cwd(),
  'tmp',
  'generated',
  lessonId,
  'page.js'
);

const fileUrl = `file://${generatedPagePath}`;
const module = await import(fileUrl);
const GeneratedLessonPage = module.default;

return <GeneratedLessonPage />;
```

## Next Steps

### Integration Required

1. **Update generation pipeline**
   - Modify `outline-request.actor-machine.ts`
   - Call `compileAndWriteTSX()` instead of storing in DB
   - Remove old compiled_code storage

2. **Update regeneration**
   - `tsx-regeneration.prompts.ts` already updated
   - Same file-based approach for retries

3. **Testing**
   - Generate a real lesson through the full pipeline
   - Verify files are written correctly
   - Test navigation to `/lessons/{id}`

### Deployment Considerations

- ✅ **Works for POC** - file system persistence
- ⚠️ **Production**: Need persistent volume or S3
- ⚠️ **Serverless**: Won't work on Vercel Edge (but fine for now)

## Migration Strategy

### Option A: Clean Start (Recommended)
1. Drop existing lessons
2. Generate new lessons with new approach
3. Test everything fresh

### Option B: Dual Support
1. Check if file exists first
2. Fall back to old eval if no file
3. Gradually migrate

## Success Metrics

### Before (Component Eval)
- ❌ 113 TypeScript errors per lesson
- ❌ Template literal escaping failures
- ❌ Missing icon imports
- ❌ 2-3 regeneration attempts needed

### After (File-Based) - Expected
- ✅ Cleaner validation (full page context)
- ✅ No template wrapping confusion
- ✅ Standard Next.js patterns
- ✅ Easier debugging (inspect files on disk)

## Testing the POC

```bash
# 1. Run test script
NODE_ENV=development bun scripts/test-file-based-generation.ts

# 2. Start dev server
bun run dev

# 3. Visit generated lesson
open http://localhost:3000/lessons/test-1762540530606

# 4. Should see interactive quiz page!
```

## Conclusion

This architectural pivot:
- ✅ Simplifies LLM task (generate full pages)
- ✅ Removes validation confusion (no wrapping)
- ✅ Uses standard patterns (dynamic imports)
- ✅ Easier to debug (files on disk)
- ✅ More deterministic (full context)

**Status**: Ready for integration into main pipeline.
