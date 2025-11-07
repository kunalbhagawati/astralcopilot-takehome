/**
 * Dynamic Lesson Page
 *
 * Server Component that renders generated lesson components using runtime evaluation.
 * Fetches compiled JavaScript code from database and evaluates it at runtime
 * using the LessonTSXRenderer component.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LessonTSXRenderer } from '@/components/lesson-tsx-renderer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LessonPage({ params }: PageProps) {
  const { id: lessonId } = await params;

  // Fetch lesson from database with compiled code
  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from('lesson')
    .select('id, title, created_at, compiled_code')
    .eq('id', lessonId)
    .single();

  if (error || !lesson) {
    console.error('Lesson not found:', error);
    notFound();
  }

  // Check if compiled code exists
  if (!lesson.compiled_code) {
    console.error('Lesson has no compiled code');
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Lesson Not Ready</CardTitle>
          <CardDescription>This lesson has not been compiled yet. It may still be generating.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded p-4 mb-4">
            <p className="text-sm font-mono">Lesson ID: {lessonId}</p>
          </div>
          <Link href="/" className="text-primary hover:underline">
            ← Back to Home
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Render the lesson component using runtime evaluation (layout handles page structure)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{lesson.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <LessonTSXRenderer compiledCode={lesson.compiled_code} lessonTitle={lesson.title} />
      </CardContent>
    </Card>
  );
}
