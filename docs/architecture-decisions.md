# Architecture Decisions: Lesson Component Rendering

## Executive Summary

**Chosen Approach:** Component-only runtime evaluation with static page shell

**Key Decision:** Store and evaluate only the lesson component, not full page files

**Rationale:** Simpler runtime execution, smaller security surface, clearer separation of concerns

---

## Current Approach: Component Evaluation

### What It Is

```
┌─────────────────────────────────────┐
│ LLM generates:                      │
│   export const LessonComponent = () │
│   => { return <div>...</div> }      │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Validate (ESLint + TypeScript)      │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Compile TSX → JavaScript            │
│   const LessonComponent = () =>     │
│   React.createElement(...)          │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Store in DB: compiled_code          │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Runtime: Evaluate with new Function │
│   Pass only React context           │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Wrap in static page shell:          │
│   - Navigation                      │
│   - State management                │
│   - DB queries                      │
│   - Prev/Next buttons               │
└─────────────────────────────────────┘
```

### Why This Works

**✅ Simplicity**

- Eval only needs React (one dependency)
- Small code surface to sandbox
- Clear boundary: static shell vs dynamic component

**✅ Security** (for future)

- Static shell is tested/trusted code
- Component is isolated, can't access routing/DB
- Easy to add content security policies

**✅ Maintainability**

- Page shell can be updated without regenerating lessons
- Component validation is straightforward
- Clear separation of concerns

**✅ Performance**

- Smaller code to evaluate
- Only component needs validation/compilation
- Can cache shell, evaluate component on demand

### Trade-offs

**❌ Limitations**

- Component can't use external imports (Phase 1)
- Must use HTML elements + Tailwind only
- No shadcn components (until Phase 2)

**⚠️ Complexity**

- Need custom evaluation logic
- Import handling requires future work (Phase 2)
- Not standard Next.js pattern

---

## Alternative 1: Full Page File Storage

### What It Would Be

```
┌─────────────────────────────────────┐
│ LLM generates:                      │
│   'use client';                     │
│   import { useState } from 'react'; │
│   export default function Page() {  │
│     const [state] = useState();     │
│     return <div>...</div>           │
│   }                                 │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Write to: app/lessons/[id]/page.tsx │
│ OR store in DB/S3 as full file      │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ HOW TO EXECUTE?                     │
│                                     │
│ Option A: Rebuild Next.js (slow)    │
│ Option B: Eval full page (complex)  │
└─────────────────────────────────────┘
```

### Why NOT This

**❌ Next.js Build Integration**

- Writing files doesn't add to Next.js routing
- Would need full rebuild to recognize new routes
- Production filesystem is ephemeral (files disappear)
- Not "dynamic" - defeats POC purpose

**❌ Runtime Execution Complexity**

- If eval'ing: Need to pass ALL imports (React, useState, Card, Button, etc.)
- Much larger code surface (state + queries + nav + component)
- Harder to sandbox
- More dependencies to manage

**❌ Validation Unchanged**

- ESLint/TypeScript work same on component or full page
- No actual simplification
- Same validation pipeline either way

**❌ LLM Control Expanded**

- LLM now controls: state, queries, navigation, routing
- Larger attack surface
- Harder to constrain behavior

### When It WOULD Make Sense

**Only if:**

- Pre-generating all lessons at build time
- Checking generated files into git
- Not doing runtime generation
- Treating lessons as static content

**But then:** Why have user input? Just write lessons manually.

---

## Alternative 2: Template Slot Pattern

### What It Would Be

**System Prompt:**

```
Fill the CONTENT_SLOT in this template:

'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LessonPage() {
  return (
    <main className="max-w-4xl mx-auto p-6">
      {/* <<<CONTENT_SLOT>>> */}

      {/* <<<END_SLOT>>> */}
    </main>
  );
}
```

**LLM Output:**

```typescript
'use client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LessonPage() {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <Card>
        <h1>My Lesson</h1>
        <p>Content here...</p>
      </Card>
    </main>
  );
}
```

### Why NOT This (for Phase 1)

**❌ Validation Doesn't Catch Template Violations**

- Validation checks: "Is this valid TypeScript/React?"
- Validation DOESN'T check: "Did you follow the template?"
- LLM could:
  - Modify imports
  - Change page structure
  - Break out of slot
  - Ignore template entirely
- No automated way to enforce template compliance

**❌ Runtime Complexity Increases**

- Still need to eval at runtime (same problems as Alternative 1)
- Need to pass ALL template imports to Function constructor:

  ```typescript
  new Function('React', 'Card', 'Button', 'useState', 'useRouter', ..., fullPageJS)
  ```

- MORE complex than current (only pass React)
- More dependencies to track and provide

**❌ No Actual Simplification**

- Doesn't solve execution problem
- Doesn't simplify validation
- Doesn't enable Next.js routing
- Just moves complexity around

### Why It MIGHT Make Sense (Phase 2)

**If you implement import whitelist:**

- Template defines allowed imports explicitly
- Easier to see what dependencies are needed
- Clearer contract between LLM and runtime
- Better import management

**But:** Still need whitelist + module context (see `dynamic-imports-strategy.md`)

**For Phase 1:** Adds complexity without benefit

---

## Comparison Matrix

| Aspect | Component Eval | Full Page File | Template Slot |
|--------|---------------|----------------|---------------|
| **Validation Difficulty** | Same | Same | Same |
| **Runtime Eval Complexity** | Simple (1 dep) | Complex (15+ deps) | Complex (15+ deps) |
| **Import Handling** | Phase 2 needed | Phase 2 needed | Phase 2 needed |
| **Next.js Integration** | Dynamic ✅ | Requires rebuild ❌ | Requires rebuild ❌ |
| **Security Surface** | Small ✅ | Large ❌ | Large ❌ |
| **LLM Control** | Component only ✅ | Full page ❌ | Full page ❌ |
| **Maintainability** | Shell separate ✅ | All in one ❌ | Template coupling ⚠️ |
| **Production Deploy** | Works ✅ | Ephemeral FS ❌ | Ephemeral FS ❌ |

---

## Decision Rationale

### Why Component-Only Wins

**1. Runtime Execution is Simplest**

```typescript
// Component approach: Pass 1 dependency
const Component = new Function('React', componentJS)(React);

// Full page: Pass 15+ dependencies
const Page = new Function(
  'React', 'useState', 'Card', 'Button', 'createClient', ...
  fullPageJS
)(React, useState, Card, Button, createClient, ...);
```

**2. Next.js Dynamic Routing Works**

- One route file handles all lessons: `/lessons/[id]`
- Fetch lesson from DB using ID
- No rebuild needed
- Production-ready

**3. Validation is Identical**

- Both validate strings with ESLint + TypeScript
- No difference in difficulty
- Argument "full page is easier to validate" is false

**4. Security is Layered**

- Static shell: trusted, tested, controlled
- Component: sandboxed, isolated, constrained
- Clear boundary

**5. Maintenance is Cleaner**

- Update shell → all lessons benefit
- Update component → only that lesson
- No coupling

### What We Sacrifice (Acceptable)

**❌ No external imports (Phase 1)**

- Component uses: React, HTML, Tailwind only
- No shadcn, lucide-react, utility libraries
- **Mitigation:** Phase 2 adds whitelist (see `dynamic-imports-strategy.md`)

**❌ Custom eval logic needed**

- Not standard Next.js pattern
- Need `new Function()` constructor
- **Mitigation:** Well-documented, isolated, tested

**❌ Must strip imports/exports**

- Can't use module syntax in eval
- **Mitigation:** Simple regex, 3 lines of code

---

## Future Considerations

### Phase 2: Import Whitelist

**When:** Need shadcn components, icons, utilities

**How:** See `docs/dynamic-imports-strategy.md`

**Approach:**

1. Define allowed imports in config
2. Parse imports from compiled code
3. Transform imports → module access
4. Pass module context to Function constructor

**Benefit:** Full library support while maintaining security

### Template Slot Reconsidered

**After Phase 2:**

- Template defines imports upfront
- Clearer dependency management
- Easier to see what's available
- Better LLM guidance

**Before Phase 2:**

- No benefit over component-only
- Adds complexity without solving core issues

### Alternative: MDX

**Future Option:** Use MDX instead of React components

- Markdown with JSX embedded
- Simpler for content-heavy lessons
- Built-in Next.js support
- Less code validation needed

**Trade-off:** Less flexibility, more constrained

---

## Conclusion

**Current approach (component evaluation) is optimal for:**

- ✅ POC / MVP phase
- ✅ Dynamic lesson generation
- ✅ Production deployment
- ✅ Security-conscious design
- ✅ Maintainable codebase

**Alternative approaches add complexity without solving core problems:**

- Full page files require rebuild or complex eval
- Template slots don't simplify validation or execution
- Both require same import handling as component approach

**For Phase 1: Component-only is the right choice**

**For Phase 2: Add import whitelist, possibly reconsider template pattern**

---

## References

- Implementation: `components/lesson-tsx-renderer.tsx`
- Lesson page: `app/lessons/[id]/page.tsx`
- Import strategy: `docs/dynamic-imports-strategy.md`
- Validation pipeline: `lib/services/validation/`
- Compilation: `lib/services/compilation/tsx-compiler.ts`
