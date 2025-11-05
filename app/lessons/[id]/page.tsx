'use client';

import { LessonTSXRenderer } from '@/components/lesson-tsx-renderer';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Lesson, LessonStatus } from '@/lib/types/lesson';
import { ArrowLeft, ArrowRight, Home, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Extended lesson type with status information
 */
type LessonWithStatus = Lesson & {
  status?: LessonStatus;
  metadata?: Record<string, unknown> | null;
};

/**
 * Navigation info for prev/next lessons
 */
interface LessonNavigation {
  previousLessonId: string | null;
  nextLessonId: string | null;
  currentIndex: number;
  totalLessons: number;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<LessonWithStatus | null>(null);
  const [navigation, setNavigation] = useState<LessonNavigation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLessonAndNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const fetchLessonAndNavigation = async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    // Step 1: Fetch the lesson
    const { data: lessonData, error: lessonError } = await supabase
      .from('lesson')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (lessonError || !lessonData) {
      console.error('Error fetching lesson:', lessonError);
      setError('Lesson not found');
      setIsLoading(false);
      return;
    }

    // Step 2: Fetch latest status for this lesson
    const { data: statusData, error: statusError } = await supabase
      .from('lesson_status_record')
      .select('status, metadata')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error('Error fetching lesson status:', statusError);
    }

    // Combine lesson with status
    const lessonWithStatus: LessonWithStatus = {
      ...lessonData,
      status: statusData?.status,
      metadata: statusData?.metadata as Record<string, unknown> | null,
    };

    setLesson(lessonWithStatus);

    // Step 3: Find which outline this lesson belongs to
    const { data: mappingData, error: mappingError } = await supabase
      .from('mapping_outline_request_lesson')
      .select('outline_request_id')
      .eq('lesson_id', lessonId)
      .single();

    if (mappingError || !mappingData) {
      console.error('Error fetching lesson mapping:', mappingError);
      setIsLoading(false);
      return;
    }

    const outlineRequestId = mappingData.outline_request_id;

    // Step 4: Fetch all lessons in the same outline (ordered by created_at)
    const { data: allMappings, error: allMappingsError } = await supabase
      .from('mapping_outline_request_lesson')
      .select('lesson_id, created_at')
      .eq('outline_request_id', outlineRequestId)
      .order('created_at', { ascending: true });

    if (allMappingsError || !allMappings) {
      console.error('Error fetching all lesson mappings:', allMappingsError);
      setIsLoading(false);
      return;
    }

    // Step 5: Determine prev/next lesson IDs
    const lessonIds = allMappings.map((m) => m.lesson_id);
    const currentIndex = lessonIds.indexOf(lessonId);

    const navInfo: LessonNavigation = {
      previousLessonId: currentIndex > 0 ? lessonIds[currentIndex - 1] : null,
      nextLessonId: currentIndex < lessonIds.length - 1 ? lessonIds[currentIndex + 1] : null,
      currentIndex: currentIndex + 1, // 1-indexed for display
      totalLessons: lessonIds.length,
    };

    setNavigation(navInfo);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={'/'}>Lesson Generator</Link>
            </div>
            <ThemeSwitcher />
          </div>
        </nav>

        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  if (error || !lesson) {
    return (
      <main className="min-h-screen flex flex-col">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={'/'}>Lesson Generator</Link>
            </div>
            <ThemeSwitcher />
          </div>
        </nav>

        <div className="flex-1 w-full flex flex-col items-center p-5">
          <div className="w-full max-w-5xl">
            <Button variant="outline" onClick={() => router.push('/')} className="mb-4">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-destructive">{error || 'Lesson not found'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  const generatedCode = lesson.generated_code as { tsxCode: string; componentName: string } | null;

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
          <div className="flex gap-5 items-center font-semibold">
            <Link href={'/'}>Lesson Generator</Link>
          </div>
          <ThemeSwitcher />
        </div>
      </nav>

      <div className="flex-1 w-full flex flex-col items-center p-5">
        <div className="w-full max-w-5xl flex flex-col gap-6">
          {/* Back to Outline Button */}
          <Button variant="outline" onClick={() => router.push('/')} className="w-fit">
            <Home className="h-4 w-4 mr-2" />
            Back to Outline
          </Button>

          {/* Lesson Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl">{lesson.title || 'Untitled Lesson'}</CardTitle>
                  <CardDescription className="mt-2">
                    {navigation && (
                      <>
                        Lesson {navigation.currentIndex} of {navigation.totalLessons}
                        {' • '}
                      </>
                    )}
                    Created:{' '}
                    {lesson.created_at
                      ? new Date(lesson.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A'}
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    lesson.status === 'completed' ? 'default' : lesson.status === 'failed' ? 'destructive' : 'secondary'
                  }>
                  {lesson.status || 'unknown'}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Lesson Content - Rendered JSX */}
          {generatedCode ? (
            <div className="lesson-content-container">
              <LessonTSXRenderer generatedCode={generatedCode} lessonTitle={lesson.title || 'Untitled Lesson'} />
            </div>
          ) : (
            <Card className="border-yellow-500">
              <CardContent className="pt-6">
                <p className="text-sm text-yellow-600">
                  No generated code available for this lesson. The lesson may still be generating or may have failed.
                </p>
                {lesson.status === 'failed' && lesson.metadata && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-destructive">Error Details:</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {typeof lesson.metadata === 'object' &&
                      lesson.metadata !== null &&
                      'message' in lesson.metadata &&
                      typeof lesson.metadata.message === 'string'
                        ? lesson.metadata.message
                        : JSON.stringify(lesson.metadata)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation Footer */}
          {navigation && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigation.previousLessonId && router.push(`/lessons/${navigation.previousLessonId}`)
                    }
                    disabled={!navigation.previousLessonId}
                    className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous Lesson
                  </Button>

                  <Button variant="outline" onClick={() => router.push('/')} className="flex-1">
                    <Home className="h-4 w-4 mr-2" />
                    Back to Outline
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => navigation.nextLessonId && router.push(`/lessons/${navigation.nextLessonId}`)}
                    disabled={!navigation.nextLessonId}
                    className="flex-1">
                    Next Lesson
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
        <p className="text-muted-foreground">Powered by Supabase & Next.js</p>
      </footer>
    </main>
  );
}
