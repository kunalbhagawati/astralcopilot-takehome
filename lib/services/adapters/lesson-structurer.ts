import { LessonContent, LessonSection } from '@/lib/types/lesson';

/**
 * Adapter interface for lesson structuring systems
 * Converts an outline into a structured lesson format
 */
export interface LessonStructurer {
  structure(outline: string): Promise<LessonContent>;
}

/**
 * Dummy implementation for development
 * Returns mock structured content based on the outline
 */
export class DummyLessonStructurer implements LessonStructurer {
  async structure(outline: string): Promise<LessonContent> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extract title from outline (first line or first 100 chars)
    const title = outline.split('\n')[0].slice(0, 100).trim();

    // Generate mock sections based on outline
    const sections: LessonSection[] = this.generateMockSections(outline);

    return {
      title,
      description: `A comprehensive lesson based on: ${outline.slice(0, 150)}${outline.length > 150 ? '...' : ''}`,
      sections,
      metadata: {
        difficulty: 'intermediate',
        estimatedTime: sections.length * 5, // 5 minutes per section
        topics: this.extractTopics(outline),
      },
    };
  }

  private generateMockSections(outline: string): LessonSection[] {
    const sections: LessonSection[] = [];

    // Introduction section
    sections.push({
      id: 'section-1',
      title: 'Introduction',
      content: `Welcome to this lesson! We'll be covering the following topic: ${outline.slice(0, 100)}`,
      type: 'text',
      order: 1,
    });

    // Check if it's a quiz request
    if (outline.toLowerCase().includes('quiz')) {
      const questionCount = this.extractQuestionCount(outline);
      for (let i = 0; i < questionCount; i++) {
        sections.push({
          id: `question-${i + 1}`,
          title: `Question ${i + 1}`,
          content: `Sample question ${i + 1} related to the topic. [This is a placeholder for actual generated content]`,
          type: 'question',
          order: i + 2,
        });
      }
    } else {
      // General content sections
      sections.push({
        id: 'section-2',
        title: 'Main Content',
        content: 'This is where the main lesson content would appear. [Placeholder for actual generated content]',
        type: 'text',
        order: 2,
      });

      sections.push({
        id: 'section-3',
        title: 'Practice Exercise',
        content: 'Try this exercise to reinforce your understanding. [Placeholder for actual generated content]',
        type: 'exercise',
        order: 3,
      });
    }

    // Summary section
    sections.push({
      id: `section-${sections.length + 1}`,
      title: 'Summary',
      content: "Great job! You've completed this lesson. Review the key points above to reinforce your learning.",
      type: 'text',
      order: sections.length + 1,
    });

    return sections;
  }

  private extractQuestionCount(outline: string): number {
    // Try to extract number from phrases like "10 question quiz"
    const match = outline.match(/(\d+)\s*(question|q)/i);
    return match ? parseInt(match[1], 10) : 5; // Default to 5 questions
  }

  private extractTopics(outline: string): string[] {
    // Simple topic extraction - in real implementation, this would be more sophisticated
    const words = outline
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 4);
    return words.slice(0, 3); // Return first 3 significant words as topics
  }
}

// Factory function to get the structurer instance
export function getLessonStructurer(): LessonStructurer {
  // In the future, this could return different implementations based on config
  return new DummyLessonStructurer();
}
