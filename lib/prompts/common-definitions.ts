/**
 * Common prompt definitions shared across validation and generation prompts
 *
 * This file contains reusable prompt fragments to ensure consistency
 * across different stages of the content generation pipeline.
 */

/**
 * Block definition used in both validation and blocks generation prompts
 *
 * Defines what an "actionable block" is - the atomic unit of teaching content.
 * This definition is referenced when validating outlines (to explain the ≤100 blocks constraint)
 * and when generating blocks (to guide the LLM on what to create).
 */
export const BLOCK_DEFINITION = `
WHAT ARE ACTIONABLE BLOCKS?
Actionable blocks are teaching points - discrete chunks of "what to teach."

Each block is:
- **Atomic**: ONE concept or teaching point only
- **Structured**: Can be text, images, or interactions (see BLOCK_TYPES below)
- **Self-contained**: Makes sense on its own
- **Age-appropriate**: Matches the target student age range
- **Progressive**: Builds from simple to complex

Think of blocks as talking points for a teacher - what would you cover, in what order?
Now with support for visual aids and interactive elements to reinforce learning.
`;

/**
 * Block types definition
 *
 * Describes the three types of blocks that can be created.
 * Used in blocks generation and TSX generation prompts.
 */
export const BLOCK_TYPES_DEFINITION = `
BLOCK TYPES:

1. **TEXT BLOCKS** (type: "text")
   - Standard teaching content
   - Markdown formatted
   - 1-3 sentences explaining one concept
   - Use **bold** for emphasis on key terms
   - Example: { type: "text", content: "**What is photosynthesis?** Plants make their own food using sunlight." }

2. **IMAGE BLOCKS** (type: "image")
   - Visual content for lessons
   - Two formats:
     a) SVG (format: "svg"): Detailed description for LLM to generate inline SVG
        - Use for: Diagrams, shapes, charts, technical illustrations
        - Example: { type: "image", format: "svg", content: "A simple diagram showing a plant with arrows: sunlight from top, CO2 from air, water from roots, oxygen being released", alt: "Photosynthesis inputs and outputs diagram" }
     b) URL (format: "url"): Image URL for external images
        - Use for: Photos, complex illustrations, maps
        - Example: { type: "image", format: "url", content: "https://example.com/photo.jpg", alt: "Tropical rainforest ecosystem" }
   - ALWAYS include alt text for accessibility
   - Optional caption for context

3. **INTERACTION BLOCKS** (type: "interaction")
   - Interactive elements for engagement
   - Four subtypes:
     a) INPUT (interactionType: "input"): Text/number/range inputs
        - Use for: Experimentation ("Try changing the temperature")
        - Metadata: inputType, defaultValue, min, max
     b) QUIZ (interactionType: "quiz"): Multiple choice questions
        - Use for: Knowledge checks, recall exercises
        - Metadata: options (array), answer (correct option)
     c) VISUALIZATION (interactionType: "visualization"): Interactive SVG diagrams
        - Use for: Dynamic demonstrations ("Adjust angle to see triangle change")
        - Metadata: visualizationDescription (what to show and how it reacts)
     d) DRAGDROP (interactionType: "dragdrop"): Drag and drop activities
        - Use for: Matching, ordering, categorization
        - Metadata: items (draggable), dropZones (targets), correctMatches (validation)
   - ALWAYS include prompt (question/instruction text)

BLOCK SELECTION GUIDELINES:
- **Text blocks**: Core teaching content, definitions, explanations
- **Image blocks**: When visualization aids understanding
- **Interaction blocks**: To reinforce learning, check understanding, enable experimentation

SUBJECT-SPECIFIC GUIDANCE:
- **STEM (Math, Science, Physics, Chemistry)**: Favor SVG diagrams + visualizations
  - Example: Geometry lesson → SVG shapes + interactive angle adjuster
- **Humanities (History, Geography, Literature)**: Favor images + quizzes
  - Example: Geography lesson → Map image + drag-drop country matching
- **General**: Use whatever combination best reinforces the learning objective
`;

/**
 * Image guidelines for TSX generation
 *
 * Guides LLM on how to render image blocks into TSX.
 */
export const IMAGE_GUIDELINES = `
IMAGE RENDERING GUIDELINES:

**SVG Images (format: "svg"):**
- Generate inline <svg> element in TSX
- Use semantic, accessible SVG (title, desc elements)
- Keep SVG simple and clean
- Use Tailwind classes for sizing/positioning
- Example structure:
  <svg className="w-full max-w-md mx-auto" viewBox="0 0 400 300" role="img" aria-labelledby="svg-title">
    <title id="svg-title">{alt text}</title>
    <desc>{more detailed description}</desc>
    {/* SVG content */}
  </svg>

**URL Images (format: "url"):**
- Use <img> element with proper attributes
- MUST include alt text (from block.alt)
- Responsive sizing with Tailwind
- Optional <figcaption> if caption provided
- Example structure:
  <figure className="my-6">
    <img
      src={content}
      alt={alt}
      className="w-full rounded-lg shadow-md"
    />
    {caption && <figcaption className="text-center text-sm text-gray-600 mt-2">{caption}</figcaption>}
  </figure>

ACCESSIBILITY REQUIREMENTS:
- Alt text MUST describe the image content meaningfully
- Decorative images: use aria-hidden="true"
- Complex diagrams: provide detailed description in alt or nearby text
`;

/**
 * Interaction guidelines for TSX generation
 *
 * Guides LLM on how to render interaction blocks into TSX with state management.
 */
export const INTERACTION_GUIDELINES = `
INTERACTION RENDERING GUIDELINES:

**General Pattern:**
- Use useState (from 'react') for managing interaction state
- Provide immediate feedback to user actions
- Clear, accessible UI with proper labels
- Responsive design with Tailwind

**INPUT Interactions:**
- Render appropriate <input> element (text, number, range)
- Show current value and allow changes
- Display results/effects of input changes
- Example pattern:
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">{prompt}</label>
      <input
        type={inputType}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full p-2 border rounded"
        min={min}
        max={max}
      />
      <div className="text-lg">Result: {/* show effect of value */}</div>
    </div>
  );

**QUIZ Interactions:**
- Radio buttons for single-choice questions
- Show feedback on selection
- Validate against correct answer from metadata
- Example pattern:
  const [selected, setSelected] = useState(null);
  const isCorrect = selected === answer;
  return (
    <div className="space-y-4">
      <p className="font-medium">{prompt}</p>
      {options.map(option => (
        <label key={option} className="flex items-center space-x-2">
          <input type="radio" checked={selected === option} onChange={() => setSelected(option)} />
          <span>{option}</span>
        </label>
      ))}
      {selected && (
        <div className={isCorrect ? "text-green-600" : "text-red-600"}>
          {isCorrect ? "Correct!" : "Try again!"}
        </div>
      )}
    </div>
  );

**VISUALIZATION Interactions:**
- SVG with interactive state
- Use useState to track adjustable parameters
- Update SVG based on state changes
- Example: Slider controls angle, SVG triangle updates accordingly

**DRAGDROP Interactions:**
- HTML5 drag and drop API
- Track dropped items with useState
- Validate against correctMatches from metadata
- Provide feedback on correct/incorrect placement

ACCESSIBILITY:
- Keyboard navigation support
- ARIA labels and roles
- Focus management
- Screen reader friendly feedback
`;

/**
 * Allowed imports list for lesson components
 *
 * Whitelist of libraries that can be imported in generated TSX code.
 * Used in both blocks generation (for reference) and TSX generation (for code).
 *
 * Based on project's package.json, filtered for educational utility.
 */
export const ALLOWED_IMPORTS_LIST = `
ALLOWED IMPORTS FOR LESSON COMPONENTS:

You may import the following libraries in your generated TSX code:

**REACT HOOKS:**
- import { useState } from 'react'
  - Use for: Interactive state (quiz answers, input values, etc.)
  - Example: const [answer, setAnswer] = useState('');

**ICONS:**
- import { IconName } from 'lucide-react'
  - Available icons: ArrowRight, CheckCircle, XCircle, Star, Heart, Sun, Moon, Play, Pause, etc.
  - Use for: Visual cues, feedback, decorative elements
  - Example: import { CheckCircle, XCircle } from 'lucide-react'

**UI COMPONENTS (Radix UI):**
- import { Checkbox } from '@radix-ui/react-checkbox'
  - Use for: Quiz interactions, selection UI
- import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@radix-ui/react-accordion'
  - Use for: Expandable content, progressive disclosure
- import { Label } from '@radix-ui/react-label'
  - Use for: Form labels, accessibility

**STYLING UTILITIES:**
- import { clsx } from 'clsx'
  - Use for: Conditional className logic
- import { twMerge } from 'tailwind-merge'
  - Use for: Merging Tailwind classes safely

**CRITICAL RESTRICTIONS:**
❌ NEVER import:
- Local components (./ComponentName, ./QuizComponent, ../utils/helper, etc.)
  - These files do NOT exist in the codebase
  - Build all interactive elements inline instead
- Next.js router/navigation (useRouter, Link, redirect, etc.)
  - Navigation is not allowed in lesson components
- Supabase client or database access (@supabase/supabase-js)
  - Database access is not allowed in lesson components
- Server-only libraries (server-only, next/server, etc.)
- File system access (fs, path, etc.)
- Any library not explicitly listed above

**VALIDATION:**
- Imports are validated against whitelist at compilation
- Non-whitelisted imports will cause validation errors
- Local imports (./ComponentName) will FAIL validation
- Use only what's needed - don't import unnecessarily

**CORRECT USAGE PATTERN:**
import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Checkbox } from '@radix-ui/react-checkbox';
import { clsx } from 'clsx';

export const LessonComponent = () => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="space-y-4">
      <Checkbox checked={checked} onCheckedChange={setChecked} />
      <CheckCircle className={clsx("w-6 h-6", checked ? "text-green-500" : "text-gray-400")} />
    </div>
  );
};
`;
