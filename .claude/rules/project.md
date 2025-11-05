---
applyTo: ['app/**/*.ts', 'app/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx', 'lib/**/*.ts', 'lib/**/*.tsx']
---

# Project Runtime and Package Manager

**This project uses Bun as both the JavaScript runtime and package manager.**

- Use `bun` for running scripts and managing dependencies
- Use `bunx` for executing packages (equivalent to `npx`)
- DO NOT use `npm`, `yarn`, or `pnpm` commands

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

- Prefer arrow functions for all functions
  `const myFunction = (param: Type): ReturnType => { ... }`
- Both arrow functions and regular function declarations work in Next.js
- Exception: Avoid arrow functions in classes (not shared across instances)
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
- Files: kebab-case (e.g., `button.tsx`, `user-card.tsx`, `navigation-menu.tsx`)
- Component names: PascalCase (e.g., `Button`, `UserCard`, `NavigationMenu`)
- Prevents case-sensitivity issues across operating systems

**Pages/Routes (`app/**`):**

- Use Next.js App Router conventions
- Special files (all kebab-case when applicable):
  - `page.tsx` - Route endpoints
  - `layout.tsx` - Shared UI (headers, nav, footers)
  - `route.ts` - API endpoints
  - `loading.tsx` - Loading skeletons
  - `error.tsx` - Error boundaries
  - `not-found.tsx` - 404 pages
  - `template.tsx` - Re-rendered layouts
  - `default.tsx` - Parallel route fallbacks
- Route groups: `(auth)`, `(dashboard)` - Organizational, not in URL
- Private folders: `_components`, `_lib` - Ignored by routing
- Co-location: Components used only by specific routes can live alongside them

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

### Export Patterns

**Reusable Components (components/**):**
Use named exports for better refactoring and auto-imports:

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

**Next.js Special Files (page.tsx, layout.tsx, etc.):**
Use default exports (Next.js requirement):

```typescript
interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function Page({ params, searchParams }: PageProps) {
  // Implementation
}
```

**Rationale:**

- Named exports: Better IDE support, safer refactors, prevents naming mistakes
- Default exports: Required by Next.js for pages, layouts, route handlers, error/loading/not-found files

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

- NEVER run development servers (`bun run dev`, `bun dev`) in AI agent mode
- Assume dev server may already be running on default port (3000)
- For verification, use: unit tests, curl commands, or log checking
- Do NOT start new server instances

## API Routes

- Place API routes in `app/api/**` directory
- Use `route.ts` naming convention
- Export named functions: GET, POST, PUT, DELETE, PATCH
- Always validate input and handle errors
- Return `NextResponse` objects

## Server Actions

Server Actions are async functions executed on the server for data mutations and form handling.
Reference: <https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations>

### Two Patterns

**Function-level (inline in Server Components):**

```typescript
export default function Page() {
  async function createPost(formData: FormData) {
    'use server'
    // Server Action logic
    const title = formData.get('title')
    // ... database mutation
  }

  return <form action={createPost}>...</form>
}
```

**Module-level (separate file):**

```typescript
// app/actions/posts.ts
'use server'

export async function createPost(formData: FormData) {
  // Server Action logic
}

export async function deletePost(id: string) {
  // Server Action logic
}
```

### Requirements

- MUST be async functions
- MUST include `"use server"` directive (function-level or module-level)
- Arguments and return values MUST be serializable
- Can be called from Server Components and Client Components
- Use for form submissions, data mutations, and server-side operations

## Data Fetching & Caching

Reference: <https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating>

### Fetching Patterns

**Server Components (default):**

```typescript
// Cached by default
async function getData() {
  const res = await fetch('https://api.example.com/data')
  return res.json()
}

export default async function Page() {
  const data = await getData()
  return <div>{data.title}</div>
}
```

### Caching Options

**Force Cache:**

```typescript
fetch('https://api.example.com/data', { cache: 'force-cache' })
```

**No Cache (dynamic):**

```typescript
fetch('https://api.example.com/data', { cache: 'no-store' })
```

**Time-based Revalidation:**

```typescript
// Revalidate every hour
fetch('https://api.example.com/data', { next: { revalidate: 3600 } })
```

### On-Demand Revalidation

**By Path:**

```typescript
import { revalidatePath } from 'next/cache'

async function createPost() {
  'use server'
  // ... create post
  revalidatePath('/posts')
}
```

**By Tag:**

```typescript
import { revalidateTag } from 'next/cache'

// Tag the fetch
fetch('https://api.example.com/posts', { next: { tags: ['posts'] } })

// Revalidate all fetches with this tag
async function action() {
  'use server'
  revalidateTag('posts')
}
```

### Route Segment Config

```typescript
// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Revalidate every 60 seconds
export const revalidate = 60
```

## Metadata & SEO

Reference: <https://nextjs.org/docs/app/api-reference/functions/generate-metadata>

### Static Metadata

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description',
  openGraph: {
    title: 'OG Title',
    description: 'OG Description',
  },
}

export default function Page() {
  return <div>Content</div>
}
```

### Dynamic Metadata

```typescript
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const post = await fetchPost(params.id)

  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default function Page({ params }: { params: { id: string } }) {
  // ...
}
```

### Requirements

- ONLY use in Server Components (metadata exports not supported in Client Components)
- CANNOT export both `metadata` object and `generateMetadata` function from same route
- Use static metadata when data doesn't depend on runtime information
- Use `generateMetadata` for dynamic metadata based on route params or external data

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

- [ ] Type checking passes (`bun run lint`)
- [ ] Linting passes for staged (`bunx lint-staged`)
- [ ] `bun run build` passes without errors

## Documentation ✓

- [ ] Library URLs included
- [ ] Problem and solution explained
- [ ] Complex logic commented
- [ ] Versions documented
- [ ] Server/Client Component clearly indicated
