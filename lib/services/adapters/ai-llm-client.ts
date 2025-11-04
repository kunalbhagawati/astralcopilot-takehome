import { ValidationResult } from '@/lib/types/lesson';
import { LessonContent, LessonSection } from '@/lib/types/lesson-structure.types';
import type { LLMProvider } from './llm-config';
import { getLLMProvider } from './llm-config';

/**
 * Interface for AI LLM clients that generate and validate lessons
 *
 * This abstraction allows swapping between different LLM providers
 * (OpenAI, Anthropic, etc.) without changing the business logic
 */
export interface AILLMClient {
  /**
   * Provider name for this client
   */
  readonly provider: LLMProvider;

  /**
   * Generates lesson content from an outline
   *
   * @param outline - The outline text to generate a lesson from
   * @returns Structured lesson content
   */
  generateLesson(outline: string): Promise<LessonContent>;

  /**
   * Validates lesson content quality using AI
   *
   * @param content - The lesson content to validate
   * @returns ValidationResult with quality assessment
   */
  validateLesson(content: LessonContent): Promise<ValidationResult>;
}

/**
 * Dummy implementation of AILLMClient for testing and development
 *
 * Simulates AI API calls with realistic delays and generates mock lesson content
 * based on the outline text
 */
export class DummyAILLMClient implements AILLMClient {
  readonly provider = 'ollama' as const;

  async generateLesson(outline: string): Promise<LessonContent> {
    // Simulate API call delay (1-2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const lines = outline.split('\n').filter((line) => line.trim().length > 0);
    const title = lines[0] || 'Untitled Lesson';

    // Extract topics from outline (simple keyword extraction)
    const topicKeywords = this.extractTopics(outline);

    // Detect if outline mentions quiz/exercise
    const hasQuiz = /quiz|question|test/i.test(outline);
    const hasExercise = /exercise|practice|code|implement/i.test(outline);

    // Generate sections based on outline
    const sections: LessonSection[] = [];
    let order = 0;

    // Always add introduction
    sections.push({
      id: `section-${order}`,
      type: 'introduction',
      title: 'Introduction',
      content: `Welcome to this lesson on ${title.toLowerCase()}. In this lesson, we will cover the following topics: ${topicKeywords.join(', ')}.`,
      order: order++,
    });

    // Add content sections for each main point in outline
    const contentPoints = lines.slice(1, Math.min(lines.length, 4));
    contentPoints.forEach((point) => {
      sections.push({
        id: `section-${order}`,
        type: 'content',
        title: this.sanitizeTitle(point),
        content: `This section covers ${point.toLowerCase()}. ${this.generateMockContent(point)}`,
        order: order++,
      });
    });

    // Add exercise if detected
    if (hasExercise) {
      sections.push({
        id: `section-${order}`,
        type: 'exercise',
        title: 'Practice Exercise',
        content: 'Try implementing what you learned in this exercise.\n\n```javascript\n// Your code here\n```',
        order: order++,
        metadata: {
          starterCode: '// Your code here',
          solution: '// Solution code would go here',
        },
      });
    }

    // Add quiz if detected
    if (hasQuiz) {
      sections.push({
        id: `section-${order}`,
        type: 'quiz',
        title: 'Knowledge Check',
        content: 'Test your understanding with these questions.',
        order: order++,
        metadata: {
          questions: [
            {
              question: 'What did you learn in this lesson?',
              options: ['Option A', 'Option B', 'Option C', 'Option D'],
              correctAnswer: 0,
            },
          ],
        },
      });
    }

    // Always add summary
    sections.push({
      id: `section-${order}`,
      type: 'summary',
      title: 'Summary',
      content: `In this lesson, you learned about ${topicKeywords.slice(0, 3).join(', ')}. Keep practicing to reinforce these concepts!`,
      order: order++,
    });

    return {
      metadata: {
        title,
        topics: topicKeywords,
        estimatedDuration: sections.length * 10, // 10 minutes per section
        description: `A comprehensive lesson covering ${title.toLowerCase()}`,
        difficulty: this.detectDifficulty(outline),
      },
      sections,
    };
  }

  async validateLesson(content: LessonContent): Promise<ValidationResult> {
    // Simulate AI validation delay (500ms-1s)
    await new Promise((resolve) => setTimeout(resolve, 750));

    const errors: string[] = [];
    const warnings: string[] = [];

    // Simulate AI quality checks
    if (content.sections.length < 2) {
      errors.push('Lesson appears too short for meaningful learning');
    }

    if (content.metadata.estimatedDuration < 5) {
      warnings.push('Lesson duration might be too short');
    }

    if (content.metadata.estimatedDuration > 120) {
      warnings.push('Lesson duration might be too long - consider splitting into multiple lessons');
    }

    // Check for content depth
    const avgContentLength = content.sections.reduce((sum, s) => sum + s.content.length, 0) / content.sections.length;

    if (avgContentLength < 50) {
      errors.push('Section content appears too brief - lacks depth');
    }

    // Random failure to simulate AI validation issues (5% chance)
    if (Math.random() < 0.05) {
      errors.push('AI detected potential quality issues with the generated content');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Extracts topic keywords from outline text
   */
  private extractTopics(outline: string): string[] {
    const words = outline
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4);

    // Get unique significant words
    const topics = [...new Set(words)].slice(0, 5);

    return topics.length > 0 ? topics : ['programming', 'concepts'];
  }

  /**
   * Sanitizes a line of text to use as a section title
   */
  private sanitizeTitle(text: string): string {
    // Remove leading numbers, dashes, asterisks
    let title = text.replace(/^[\d\-\*\.\s]+/, '').trim();

    // Limit length
    if (title.length > 60) {
      title = title.substring(0, 60) + '...';
    }

    // Capitalize first letter
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  /**
   * Generates mock content for a section
   */
  private generateMockContent(topic: string): string {
    return `Here are the key points to understand:

- First, we'll explore the fundamentals
- Then, we'll look at practical applications
- Finally, we'll discuss best practices

Understanding ${topic.toLowerCase()} is essential for building robust solutions.`;
  }

  /**
   * Detects difficulty level from outline
   */
  private detectDifficulty(outline: string): 'beginner' | 'intermediate' | 'advanced' {
    const lower = outline.toLowerCase();

    if (lower.includes('advanced') || lower.includes('expert')) {
      return 'advanced';
    }

    if (lower.includes('intermediate') || lower.includes('complex')) {
      return 'intermediate';
    }

    return 'beginner';
  }
}

/**
 * Ollama-based implementation of AILLMClient
 * Uses Ollama for real LLM-based lesson generation and validation
 */
export class OllamaAILLMClient implements AILLMClient {
  readonly provider = 'ollama' as const;
  private ollamaClient: import('./ollama-client').OllamaClient;

  constructor(ollamaClient?: import('./ollama-client').OllamaClient) {
    if (ollamaClient) {
      this.ollamaClient = ollamaClient;
    } else {
      // Dynamic import to avoid circular dependencies
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createOllamaClient } = require('./ollama-client');
      this.ollamaClient = createOllamaClient();
    }
  }

  async generateLesson(outline: string): Promise<LessonContent> {
    // First, structure the outline
    const structuredOutline = await this.ollamaClient.structureOutline(outline);

    // Then generate lesson from structured outline
    const lessonContent = await this.ollamaClient.generateLesson(structuredOutline);

    return lessonContent;
  }

  async validateLesson(content: LessonContent): Promise<ValidationResult> {
    // Use LLM to validate quality
    const qualityResult = await this.ollamaClient.validateLessonQuality(content);

    return {
      valid: qualityResult.valid,
      errors: qualityResult.errors.length > 0 ? qualityResult.errors : undefined,
    };
  }
}

/**
 * Factory function to get an AI LLM client instance
 *
 * Uses strategy pattern to select provider based on LLM_PROVIDER env var
 */
export const getAILLMClient = (): AILLMClient => {
  const provider = getLLMProvider();

  switch (provider) {
    case 'ollama':
      return new OllamaAILLMClient();
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
};
