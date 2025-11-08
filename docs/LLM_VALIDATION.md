# LLM-Based Validation Pipeline

This document describes the LLM-based validation and generation pipeline implemented for outline requests.

## Overview

The validation pipeline uses **Ollama** (local LLM runtime) to validate and process lesson outline requests through multiple stages:

1. **Validation** - Check intent, specificity, and actionability
2. **Structuring** - Convert free-text outline to structured format
3. **Generation** - Create lesson content from structured outline
4. **Quality Validation** - Verify generated content meets standards

## Architecture

```
User Outline Request
        ↓
[LLMOutlineValidator]
  - Intent Analysis (positive/negative/unclear)
  - Specificity Check (stream/domain/topic/subtopic)
  - Actionability Validation
        ↓
[OllamaClient.structureOutline()]
  - Extract topic hierarchy
  - Identify content type
  - Parse requirements
  - Extract metadata
        ↓
[OllamaClient.generateLesson()]
  - Generate lesson sections
  - Create exercises/quizzes
  - Format with markdown
        ↓
[LessonContentValidator + Quality Check]
  - Structural validation
  - Quality assessment
        ↓
Ready Lesson Content
```

## Setup

### Prerequisites

1. **Install Ollama** (v0.6+)
   ```bash
   # macOS
   brew install ollama

   # Linux
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Start Ollama server**
   ```bash
   ollama serve
   ```

3. **Pull required models**
   ```bash
   ollama pull llama3.1
   # or
   ollama pull mistral
   ```

### Environment Variables

Add to your `.env.local`:

```bash
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OUTLINE_VALIDATION_MODEL=llama3.1
CODE_GENERATION_MODEL=llama3.1

# Feature Flags
USE_LLM_VALIDATION=true
USE_OLLAMA_LLM=true
```

**Feature Flags:**
- `USE_LLM_VALIDATION=false` - Disables LLM validation, uses simple validator
- `USE_OLLAMA_LLM=false` - Disables Ollama generation, uses dummy client

## Validation Criteria

### 1. Intent Analysis

Classifies user intent as:

**Positive** ✅
- Seeks knowledge, skills, or understanding
- Educational context is clear
- Topics are constructive and legal
- Age-appropriate content

**Negative** ❌
- Harmful, illegal, or malicious content
- Requests for circumventing security
- Inappropriate content for minors
- Plagiarism or academic dishonesty

**Unclear** ⚠️
- Ambiguous phrasing
- Insufficient context
- Could be interpreted multiple ways

### 2. Specificity Analysis

Checks topic specificity level:

| Level | Description | Example | Status |
|-------|-------------|---------|--------|
| **Stream** | Broad category | "math", "science" | ❌ Too vague |
| **Domain** | Medium specificity | "algebra", "biology" | ⚠️ Borderline |
| **Topic** | Specific topic | "quadratic equations" | ✅ Good |
| **Subtopic** | Very detailed | "completing the square" | ✅ Excellent |

**Minimum Required:** Topic level

### 3. Actionability Check

Determines if outline is actionable:

✅ **Actionable if:**
- Content type is identifiable (quiz/lesson/tutorial/exercise)
- Requirements are extractable
- Sufficient context provided
- Complexity can be estimated

❌ **Not actionable if:**
- Missing critical information
- Too ambiguous to determine structure
- Conflicting requirements

## Usage

### Basic Usage

```typescript
import { getOutlineValidator } from '@/lib/services/adapters/outline-validator';

const validator = getOutlineValidator();
const result = await validator.validate('Create a quiz on photosynthesis');

if (result.valid) {
  console.log('Validation passed!');
} else {
  console.error('Validation failed:', result.errors);
}
```

### Access Enhanced Validation Details

```typescript
import { LLMOutlineValidator } from '@/lib/services/adapters/outline-validator';

const validator = new LLMOutlineValidator();
const result = await validator.validate(outline);

const enhanced = validator.getEnhancedResult(result);
if (enhanced) {
  console.log('Intent:', enhanced.intent.classification);
  console.log('Specificity:', enhanced.specificity.level);
  console.log('Actionability:', enhanced.actionability.actionable);
}
```

### Direct Ollama Client Usage

```typescript
import { createOllamaClient } from '@/lib/services/adapters/ollama-client';

const client = createOllamaClient();

// Validate
const validation = await client.validateOutline('Create a quiz on algebra');

// Structure
const structured = await client.structureOutline('Create a quiz on algebra');

// Generate
const lesson = await client.generateLesson(structured);

// Validate quality
const quality = await client.validateLessonQuality(lesson);
```

## Testing

### Run Validation Tests

```bash
bun run scripts/test-validation.ts
```

This script tests:
- Ollama connection
- Model availability
- Validation with sample outlines
- Outline structuring

### Sample Test Cases

**Valid Outlines:**
- ✅ "Create a 10-question quiz on photosynthesis for 5th graders"
- ✅ "Create a lesson on React hooks with examples and exercises"
- ✅ "Create a quiz on quadratic equations with 5 questions"

**Invalid Outlines:**
- ❌ "Teach me about math" (too vague)
- ❌ "How to hack into school computers" (negative intent)
- ❌ "Help me cheat on my test" (academic dishonesty)

## Error Handling

The implementation includes robust error handling:

### Retry Logic

- **Automatic retries** with exponential backoff
- **Max retries:** 3 (configurable)
- **Retry delay:** 1000ms, 2000ms, 4000ms

### Error Types

1. **Model Not Found**
   - Error: "Validation model 'llama3.1' not found"
   - Solution: Run `ollama pull llama3.1`

2. **Connection Error**
   - Error: "Cannot connect to Ollama server"
   - Solution: Ensure Ollama is running (`ollama serve`)

3. **Context Length Exceeded**
   - Error: "Outline is too long for validation"
   - Solution: Shorten the outline

4. **Parse Error**
   - Error: "Failed to parse LLM response"
   - Solution: Automatically retried up to 3 times

## Prompts

### System Prompts

System prompts define AI behavior and validation criteria. They are stored in:

- `lib/prompts/validation-prompts.ts` - Validation system prompt
- `lib/prompts/generation-prompts.ts` - Generation system prompt

**Key principles:**
- System prompts do the "heavy lifting" of instructions
- User prompts provide the specific content
- Low temperature (0.2) for validation consistency
- Moderate temperature (0.6) for generation creativity

### Prompt Engineering

The prompts include:
- Clear role definitions
- Specific validation criteria with examples
- Structured output requirements
- Few-shot examples for intent classification
- Ethical guidelines

## Models

### Recommended Models

**For Validation:**
- `llama3.1` (8B) - Best balance of speed and accuracy
- `llama3.2` (3B) - Faster, good for simple validation
- `mistral` (7B) - Fast with good structured output support

**For Generation:**
- `llama3.1` (8B or 70B) - Best quality content
- `mixtral` (8x7B) - Excellent for creative content
- `qwen2.5` (7B) - Good for educational content

### Model Configuration

```typescript
const client = createOllamaClient({
  validationModel: 'llama3.1',
  generationModel: 'mixtral',
  validationTemperature: 0.2,
  generationTemperature: 0.7,
});
```

## Performance

### Typical Timings

- **Validation:** 1-3 seconds
- **Structuring:** 1-2 seconds
- **Generation:** 5-15 seconds (depends on lesson complexity)
- **Quality Check:** 2-4 seconds

**Total pipeline:** ~10-25 seconds per outline

### Optimization Tips

1. **Use smaller models for validation** (llama3.2 3B)
2. **Cache system prompts** (already implemented)
3. **Batch similar requests** (not yet implemented)
4. **Use faster models** if quality permits

## Troubleshooting

### Ollama Not Running

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve
```

### Model Not Available

```bash
# List available models
ollama list

# Pull required model
ollama pull llama3.1
```

### Validation Always Fails

1. Check Ollama logs: `ollama serve` output
2. Verify model is correct: Check `OUTLINE_VALIDATION_MODEL`
3. Test with curl:
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "llama3.1",
     "prompt": "Hello",
     "stream": false
   }'
   ```

### Build Errors

```bash
# Reinstall dependencies
bun install

# Check TypeScript errors
bunx tsc --noEmit

# Rebuild
bun run build
```

## Future Enhancements

Potential improvements:

1. **Caching** - Cache validation results for similar outlines
2. **Batch Processing** - Validate multiple outlines in parallel
3. **Model Selection** - Auto-select best model based on complexity
4. **Streaming** - Stream lesson generation progress
5. **Fine-tuning** - Fine-tune models on educational content
6. **Metrics** - Track validation accuracy and generation quality
7. **A/B Testing** - Compare different prompts and models

## References

- **Ollama Docs:** https://ollama.com/
- **Structured Outputs:** https://ollama.com/blog/structured-outputs
- **Prompt Engineering Guide:** https://www.promptingguide.ai/
- **XState (State Machines):** https://statelyai.github.io/xstate/

## Support

For issues or questions:
1. Check Ollama is running: `ollama serve`
2. Verify models are available: `ollama list`
3. Run test script: `bun run scripts/test-validation.ts`
4. Check environment variables in `.env.local`
5. Review logs in console output
