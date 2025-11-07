# Dynamic Import Handling Strategy

## Overview

This document outlines the strategy for handling external library imports in dynamically generated lesson components. As of Phase 1, all imports are stripped and only React is provided. This document describes the future Phase 2 enhancement for supporting whitelisted library imports.

## Current State (Phase 1)

### What Works Now

**Generated Components Use:**
- React (useState, useEffect, all hooks)
- Native HTML elements (`<div>`, `<input>`, `<form>`, etc.)
- Tailwind CSS classes
- Inline event handlers and state management

**Import Handling:**
- All `import` statements are stripped during evaluation
- Only React is provided in the execution context
- Components are self-contained with no external dependencies

**Example Working Component:**
```tsx
export const LessonComponent = () => {
  const [count, setCount] = React.useState(0);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <button
        onClick={() => setCount(count + 1)}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Clicked {count} times
      </button>
    </main>
  );
};
```

### Limitations

- Cannot use UI component libraries (shadcn, etc.)
- Cannot use icon libraries (lucide-react)
- Cannot use utility libraries (ramda, date-fns)
- Must recreate common UI patterns manually

## Future Enhancement (Phase 2)

### Goal

Enable lesson components to import and use libraries from `package.json` in a controlled, secure manner.

### Architecture

#### 1. Import Whitelist Configuration

**Create:** `lib/config/allowed-imports.ts`

```typescript
/**
 * Whitelist of allowed imports for lesson components
 * Only libraries listed here can be imported
 */
export const ALLOWED_IMPORTS = {
  // React (already provided)
  'react': () => import('react'),

  // UI Components (shadcn)
  '@/components/ui/card': () => import('@/components/ui/card'),
  '@/components/ui/button': () => import('@/components/ui/button'),
  '@/components/ui/input': () => import('@/components/ui/input'),
  // Add more shadcn components as needed

  // Icons
  'lucide-react': () => import('lucide-react'),

  // Utilities
  'ramda': () => import('ramda'),
  'date-fns': () => import('date-fns'),

  // Explicitly disallowed (even if in package.json)
  // - Next.js router (lessons shouldn't navigate)
  // - Supabase client (lessons shouldn't access DB)
  // - Any server-side only libraries
} as const;

export type AllowedImportPath = keyof typeof ALLOWED_IMPORTS;
```

#### 2. Import Parser

**Purpose:** Extract and validate imports from compiled code

```typescript
/**
 * Parse import statements from JavaScript code
 * Returns list of import declarations with source and specifiers
 */
interface ImportDeclaration {
  source: string; // '@/components/ui/card'
  specifiers: string[]; // ['Card', 'CardHeader']
  isDefault: boolean;
}

function parseImports(code: string): ImportDeclaration[] {
  // Regex to match: import { Card, CardHeader } from '@/components/ui/card'
  // Regex to match: import React from 'react'
  // Return structured import information
}

function validateImports(imports: ImportDeclaration[]): void {
  for (const imp of imports) {
    if (!ALLOWED_IMPORTS[imp.source]) {
      throw new Error(
        `Import "${imp.source}" is not allowed. ` +
        `Only whitelisted imports can be used in lesson components.`
      );
    }
  }
}
```

#### 3. Code Transformer

**Purpose:** Convert ES6 imports to runtime module access

**Input (compiled code with imports):**
```javascript
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const LessonComponent = () => {
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, "Title"),
    React.createElement(Button, null, "Click")
  );
};
```

**Output (transformed code):**
```javascript
const { Card, CardHeader } = __modules['@/components/ui/card'];
const { Button } = __modules['@/components/ui/button'];

export const LessonComponent = () => {
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, "Title"),
    React.createElement(Button, null, "Click")
  );
};
```

**Implementation:**
```typescript
function transformImports(
  code: string,
  imports: ImportDeclaration[]
): string {
  let transformed = code;

  // Replace each import with module access
  for (const imp of imports) {
    const importLine = buildImportRegex(imp);
    const replacement = buildModuleAccess(imp);
    transformed = transformed.replace(importLine, replacement);
  }

  return transformed;
}
```

#### 4. Module Context Builder

**Purpose:** Load and provide imported modules to evaluated code

```typescript
async function buildModuleContext(
  imports: ImportDeclaration[]
): Promise<Record<string, any>> {
  const modules: Record<string, any> = {
    // Always provide React
    'react': React,
  };

  // Load each imported module
  for (const imp of imports) {
    const loader = ALLOWED_IMPORTS[imp.source];
    if (loader) {
      modules[imp.source] = await loader();
    }
  }

  return modules;
}
```

#### 5. Updated Component Evaluator

```typescript
async function evaluateComponentWithImports(
  javascript: string,
  componentName: string
): Promise<React.ComponentType> {
  // 1. Parse imports
  const imports = parseImports(javascript);

  // 2. Validate against whitelist
  validateImports(imports);

  // 3. Transform code (imports → module access)
  const transformed = transformImports(javascript, imports);

  // 4. Build module context
  const modules = await buildModuleContext(imports);

  // 5. Evaluate with module context
  const componentFactory = new Function(
    'React',
    '__modules',
    `
    ${transformed}
    return ${componentName};
    `
  );

  return componentFactory(React, modules);
}
```

### Validation Phase Integration

#### Update Validation Cycle

When LLM generates/modifies TSX:

1. **TypeScript validation** - ensures imports exist (existing)
2. **Import validation** (NEW) - ensures imports are whitelisted
3. **ESLint validation** - code quality (existing)
4. **Compilation** - TSX → JavaScript (existing)

**Add import check to validation:**

```typescript
// In lib/services/validation/tsx-validation-orchestrator.ts

async function validateTSX(tsxCode: string): Promise<TSXValidationResult> {
  const allErrors: TSXValidationError[] = [];

  // Step 1: TypeScript validation
  const tsErrors = validateWithTypeScript(tsxCode);
  allErrors.push(...tsErrors);

  // Step 2: Import validation (NEW)
  const importErrors = validateImportsInTSX(tsxCode);
  allErrors.push(...importErrors);

  if (allErrors.length > 0) {
    return { valid: false, errors: allErrors };
  }

  // Step 3: ESLint validation
  const eslintErrors = await validateWithESLint(tsxCode);
  allErrors.push(...eslintErrors);

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}
```

### LLM Prompt Updates

Update `lib/prompts/tsx-generation.prompts.ts`:

```typescript
const ALLOWED_IMPORTS_SECTION = `
ALLOWED IMPORTS:
You may import the following libraries in your components:

UI COMPONENTS (shadcn):
- import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
- import { Button } from '@/components/ui/button'
- import { Input } from '@/components/ui/input'

ICONS:
- import { ArrowRight, CheckCircle, Star, ... } from 'lucide-react'

UTILITIES:
- import * as R from 'ramda'
- import { format, parseISO } from 'date-fns'

IMPORTANT:
- Do NOT import Next.js router, navigation, or Link components
- Do NOT import Supabase client or any database access
- Do NOT import server-side only libraries
- Validation will fail if you use non-whitelisted imports
`;
```

## Security Considerations

### Whitelist Approach

✅ **Pros:**
- Explicit control over what can be imported
- Prevents access to sensitive APIs (router, database)
- Easy to audit and maintain
- Clear error messages when blocked

⚠️ **Risks Mitigated:**
- No arbitrary file system access
- No network requests (unless explicitly whitelisted)
- No access to server-side APIs
- No dynamic require() or eval() of untrusted paths

### Validation Pipeline

Multi-layer security:

1. **LLM Prompt** - Instructs what's allowed
2. **Import Validation** - Rejects non-whitelisted imports
3. **TypeScript Check** - Verifies types exist
4. **ESLint** - Code quality and patterns
5. **Sandboxed Eval** - Controlled execution context

## Implementation Checklist

### Prerequisites
- [ ] Phase 1 working (React-only components)
- [ ] Lessons successfully rendering with hooks/forms

### Phase 2 Implementation Steps

1. **Configuration**
   - [ ] Create `lib/config/allowed-imports.ts`
   - [ ] Define initial whitelist (start small)
   - [ ] Document each allowed import's purpose

2. **Import Parser**
   - [ ] Implement `parseImports()` function
   - [ ] Add tests for various import syntaxes
   - [ ] Handle edge cases (default, named, namespace imports)

3. **Import Validator**
   - [ ] Implement `validateImports()` function
   - [ ] Add to validation pipeline
   - [ ] Create clear error messages

4. **Code Transformer**
   - [ ] Implement `transformImports()` function
   - [ ] Test with compiled JavaScript output
   - [ ] Verify transformed code executes correctly

5. **Module Context**
   - [ ] Implement `buildModuleContext()` async function
   - [ ] Handle dynamic imports
   - [ ] Cache loaded modules for performance

6. **Renderer Update**
   - [ ] Update `evaluateComponent()` in lesson-tsx-renderer
   - [ ] Add async support for module loading
   - [ ] Update error handling

7. **LLM Prompt Update**
   - [ ] Add allowed imports section
   - [ ] Provide usage examples
   - [ ] Update validation instructions

8. **Testing**
   - [ ] Create test lesson with shadcn components
   - [ ] Test with lucide-react icons
   - [ ] Verify validation rejects unknown imports
   - [ ] Test error handling and messages

## Migration Path

### Gradual Rollout

**Phase 2.1:** UI Components Only
- shadcn Card, Button, Input
- Test with existing lessons
- Monitor for issues

**Phase 2.2:** Icons
- lucide-react
- Update prompts to use icons
- Regenerate sample lessons

**Phase 2.3:** Utilities
- ramda, date-fns
- Enable for specific use cases
- Document common patterns

## Performance Considerations

### Module Loading

- **First render:** Load modules dynamically
- **Subsequent renders:** Use cached modules
- **Build time:** Consider pre-bundling whitelisted imports

### Optimization Ideas

1. **Preload common imports** on page load
2. **Bundle whitelisted modules** together
3. **Cache evaluation results** per lesson
4. **Lazy load** rarely-used libraries

## Questions to Resolve

1. Should imports be async (dynamic import) or sync (pre-loaded)?
2. How to handle version conflicts with app's package.json?
3. Should we allow custom CSS imports?
4. How to document available imports for LLM?
5. Rate limiting for failed import attempts?

## References

- Phase 1 implementation: `components/lesson-tsx-renderer.tsx`
- Validation pipeline: `lib/services/validation/`
- Compilation: `lib/services/compilation/tsx-compiler.ts`
- Package dependencies: `package.json`
