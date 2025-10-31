---
applyTo: '**'
---

# General Behavioral Rules

- STRICTLY follow the problem statement or prompt. Any deviation is not acceptable.
- DO NOT remove comments or add new comments to existing code that is not part of the problem statement or prompt.
- DO NOT create new README files.
- DO NOT create example files or other new files to showcase functionality unless part of the task at hand.

# Project General Coding Standards

- Choose names that clearly convey the purpose and functionality of variables, functions, and classes.
  - Prefer self-descriptive code over comments.
- Prefer simplicity first. Follow YAGNI

# Comments in Code

- DO NOT put redundant comments explaining what the code does that's self evident.
- Explain the "why" behind complex logic, not the "what".
  - If the internals of an abstraction are not obvious, explain the "how".
- Use comments to clarify complex logic, not to state the obvious.
- Use comments to document assumptions, limitations, or potential issues.

# Response Style Guidelines

## Communication Style

- **Be succinct and precise** in all responses
- Use **crisp, direct language** without unnecessary elaboration
- Get straight to the point
- Avoid verbose explanations unless specifically requested

## When to Elaborate

- Only provide detailed explanations when explicitly asked with phrases like:
  - "explain in detail"
  - "elaborate on"
  - "give me more context"
  - "walk me through"
  - "how does this work"

## Response Structure

- Lead with the direct answer or solution
- Follow with minimal necessary context
- Use bullet points for clarity when listing items
- Keep code examples focused and minimal
- Plan first, then write code

## Tone

- Avoid hedging language unless uncertainty is relevant
- No unnecessary pleasantries or filler

## Code Responses

- Show only the essential code changes
- Minimal comments unless they add critical value
- Focus on the specific request, not general best practices (unless asked)

## Examples

**Good (Succinct):**

````
Use `Array.filter()` to remove items:
```js
const filtered = items.filter(item => item.active)
````

**Avoid (Verbose):**

```
To filter an array in JavaScript, you have several options, but the most common and recommended approach is to use the built-in `Array.filter()` method. This method creates a new array with all elements that pass the test implemented by the provided function. Here's how you can use it to remove items...
```
