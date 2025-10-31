---
applyTo: ['app/**/*.ts', 'app/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx']
---

# Pre-Implementation: Planning Phase

## When Planning Applies

- Creating NEW functions, components, or modules
- Refactoring existing interfaces
- Adding new dependencies or libraries
- For minor edits to existing code, planning is optional but encouraged

## BEFORE Writing New Code

1. **Design interfaces first** - Document:
   - Purpose and responsibilities
   - Inputs and outputs with explicit types
   - Expected behaviors and side effects
   - Clear boundaries between components
   - Keep interfaces simple and stable

2. **Define caller-callee relationships**:
   - Design the callee's interface FIRST (child components, utility functions, APIs)
   - Caller adapts to callee's interface, NOT the other way around
   - Once interfaces are used, maintain stability to prevent breaking changes

3. **Research dependencies thoroughly**:
   - Read official documentation BEFORE implementation
   - Document exact library versions being used
   - NEVER assume API behavior - verify with docs

## Next.js-Specific Planning (New Components)

4. **Define component contract BEFORE implementation**:
   - List all props with types and default values
   - Determine if component should be Server or Client Component
   - Define component responsibilities (data fetching, UI rendering, interactivity)
   - Document async behavior for Server Components

5. **Presentation BEFORE interaction** (when feasible):
   - Build JSX structure first with static/mock data
   - Implement styling and layout
   - THEN add interactivity (event handlers, state, hooks)
   - NOTE: If user request requires both together, implement together but keep concerns separated

---

# Implementation: Code Structure

## TypeScript/JavaScript Files (.ts, .js)

- Use `async/await` for asynchronous code - avoid `.then()/.catch()` where possible.

### Type Definitions

- Store all types in `{prefix}.types.ts` files (e.g., `user.types.ts`, `api.types.ts`)
- ALWAYS write explicit return types: `function name(): ReturnType {}`
- ALWAYS write explicit parameter types: `function name(param: ParamType) {}`
- Reuse and derive types from existing codebase types - avoid duplication
  - Example of reuse: `type UserResponse = Pick<User, 'id' | 'name'>`
  - Avoid: Creating `UserResponse { id: string; name: string }` when `User` type exists
- Leverage Supabase generated types from `database.types.ts` when working with database entities
- Example: `function processData(input: RawData[]): ProcessedResult {}`

### JavaScript-Specific Notes

- JavaScript files (.js) cannot have explicit TypeScript types
- Use JSDoc type annotations: `@param {string} name` and `@returns {Object}`
- Follow same structure and organization rules as TypeScript

### Function Rules

- Prefer arrow functions for all functions.
  `const myFunction = (param: Type): ReturnType => { ... }`
- MUST include JSDoc comment describing purpose and usage
- Maximum 25 lines per function (hard limit - count opening to closing brace)
- One task per function (Single Responsibility Principle)
- Prefer functional programming over object-oriented

### Nesting Rules (CRITICAL)

**Allowed (1 level):**

```typescript
const outer = () => {
  const helper = () => {}; // ✓ 1 level - OK
  const another = () => {}; // ✓ 1 level - OK
}
```

**NOT Allowed (2+ levels):**

```typescript
const outer = () => {
  const middle = () => {
    const inner = () => {}; // ✗ 2 levels - FORBIDDEN
  }
}
```

- Closures are allowed and encouraged
- Arrow functions, function expressions, and named functions all count toward nesting depth

### Code Organization

- Separate business logic from data manipulation
- Separate data manipulation from UI interactions
- Keep each concern in its own function/file

## React/Next.js Components (.tsx, .jsx)

### File Structure

**Components (`components/**`):**
- Pure UI components
- Reusable across multiple pages
- Named with PascalCase (e.g., `Button.tsx`, `UserCard.tsx`)

**Pages/Routes (`app/**`):**
- Use Next.js App Router conventions
- `page.tsx` for routes
- `layout.tsx` for layouts
- `route.ts` for API routes
- `loading.tsx`, `error.tsx` for UI states

**Utilities (`lib/**`):**
- Business logic, services, utilities
- Supabase clients and middleware
- Type definitions

### Server vs Client Components

**Default to Server Components:**
- Fetch data directly from Supabase
- No `"use client"` directive needed
- Better performance and SEO

**Use Client Components when:**
- Using React hooks (useState, useEffect, etc.)
- Handling user interactions (onClick, onChange)
- Using browser-only APIs
- Add `"use client"` directive at the top

### Component Requirements

- Explicit TypeScript types for all props
- Props interface should be defined before component
- Example:
  ```typescript
  interface ButtonProps {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }

  export const Button = ({ label, onClick, variant = 'primary' }: ButtonProps) => {
    // Implementation
  }
  ```

### Styling Strategy

**Primary: Tailwind CSS classes**

- Use Tailwind utilities for all standard styling needs
- Follow existing project patterns for consistency

**Use CSS Modules ONLY for:**

- Complex animations requiring keyframes
- Styles using CSS variables
- Nested pseudo-selectors requiring multiple levels
- Media queries requiring >5 Tailwind classes

**When using component libraries:**

- Use semantic class names (`btn-primary`) over multiple utilities
- Leverage existing component library styles

### Component Design Pattern

- Child component interfaces designed first
- Parent adapts to child's interface
- Pass data down via props, handle events via callbacks
- Avoid prop drilling - use context for deeply nested data

---

# Implementation: Documentation

## Required Documentation (ALL Files)

### External Libraries/Frameworks

- Include URL to official documentation as comment
- Document the exact version being used
- Example: `// Using @supabase/ssr v0.5.0 - https://supabase.com/docs/guides/auth/server-side`

### Before Significant Changes (applies when solving problems, adding features, or refactoring)

- Add comment explaining the problem being solved
- Add comment explaining why this implementation approach was chosen
- For non-obvious logic, explain the "how"
- Minor edits (typos, simple refactors) don't require these comments

### Component Documentation

- Document if component is Server or Client Component
- Document async behavior for Server Components
- Document all props with concrete examples
- Document expected children types if component accepts children

### Supabase-Specific Documentation

- Document RLS (Row Level Security) requirements
- Document database table relationships
- Document authentication requirements
- Example: `// Requires authenticated user - uses RLS policy on 'lessons' table`

### General Code Quality

- Use self-descriptive variable/function names
- Add comments for complex logic explaining "why"
- Document assumptions, limitations, and potential issues
- Comment non-obvious logic only (avoid stating the obvious)

## Next.js-Specific Documentation

- Document route parameters and search params
- Document server actions and their validation
- Document API route handlers with expected request/response shapes
- Document middleware behavior and protected routes

---

# Development Workflow Restrictions

## Supabase

- Use `createClient()` from appropriate module:
  - `lib/supabase/client.ts` for Client Components
  - `lib/supabase/server.ts` for Server Components and Route Handlers
  - `lib/supabase/middleware.ts` for middleware
- NEVER commit Supabase credentials to version control
- Use environment variables for all secrets
- Leverage generated types from `lib/types/database.types.ts`

## Next.js Development Server

- NEVER run development servers (`npm run dev`, `yarn dev`) in AI agent mode
- Assume dev server may already be running on default port (3000)
- For verification, use: unit tests, curl commands, or log checking
- Do NOT start new server instances

## API Routes

- Place API routes in `app/api/**` directory
- Use `route.ts` naming convention
- Export named functions: GET, POST, PUT, DELETE, PATCH
- Always validate input and handle errors
- Return `NextResponse` objects

---

# Quick Reference Checklist

## Pre-Implementation ✓

- [ ] Interface designed and documented
- [ ] Caller-callee relationships defined
- [ ] Dependencies researched
- [ ] Server vs Client Component decision made
- [ ] Props/types defined with TypeScript

## During Implementation ✓

- [ ] Types explicit and reusable
- [ ] Functions < 25 lines with JSDoc
- [ ] Nesting depth ≤ 1 level
- [ ] Logic separated by concern
- [ ] `"use client"` directive only when necessary
- [ ] Supabase client imported from correct module

## Post Implementation ✓

- [ ] `npm run build` passes without errors
- [ ] Type checking passes (if `npm run type-check` available)
- [ ] Linting passes (`bunx lint-staged`)

## Documentation ✓

- [ ] Library URLs included
- [ ] Problem and solution explained
- [ ] Complex logic commented
- [ ] Versions documented
- [ ] Server/Client Component clearly indicated

