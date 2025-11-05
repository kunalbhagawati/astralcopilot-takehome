'use client';

import { ThemeSwitcher } from '@/components/theme-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Lesson, LessonStatus, OutlineRequest, OutlineRequestStatus } from '@/lib/types/lesson';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Extended types with status information from status tables
 */
type OutlineRequestWithStatus = OutlineRequest & {
  status?: OutlineRequestStatus;
  metadata?: Record<string, unknown> | null;
};

type LessonWithStatus = Lesson & {
  title?: string;
  status?: LessonStatus;
  metadata?: Record<string, unknown> | null;
};

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const outlineRequestId = params.id as string;

  const [outlineRequest, setOutlineRequest] = useState<OutlineRequestWithStatus | null>(null);
  const [lessons, setLessons] = useState<LessonWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOutlineRequestAndLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineRequestId]);

  const fetchOutlineRequestAndLessons = async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    // Fetch outline request
    const { data: outlineRequestData, error: outlineRequestError } = await supabase
      .from('outline_request')
      .select('*')
      .eq('id', outlineRequestId)
      .single();

    if (outlineRequestError) {
      console.error('Error fetching outline request:', outlineRequestError);
      setError('Failed to load outline request');
      setIsLoading(false);
      return;
    }

    // Fetch latest status for outline request
    const { data: statusData, error: statusError } = await supabase
      .from('outline_request_status_record')
      .select('status, metadata')
      .eq('outline_request_id', outlineRequestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (statusError) {
      console.error('Error fetching outline request status:', statusError);
    }

    // Combine outline request with status
    const outlineRequestWithStatus: OutlineRequestWithStatus = {
      ...outlineRequestData,
      status: statusData?.status,
      metadata: statusData?.metadata as Record<string, unknown> | null,
    };

    setOutlineRequest(outlineRequestWithStatus);

    // Fetch associated lessons via mapping table
    const { data: mappings, error: mappingError } = await supabase
      .from('mapping_outline_request_lesson')
      .select('lesson_id')
      .eq('outline_request_id', outlineRequestId);

    if (mappingError) {
      console.error('Error fetching lesson mappings:', mappingError);
      setIsLoading(false);
      return;
    }

    if (mappings && mappings.length > 0) {
      const lessonIds = mappings.map((m) => m.lesson_id);
      const { data: lessonsData, error: lessonsError } = await supabase.from('lesson').select('*').in('id', lessonIds);

      if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
      } else if (lessonsData) {
        // Fetch statuses for all lessons
        const { data: lessonStatuses, error: lessonStatusError } = await supabase
          .from('lesson_status_record')
          .select('lesson_id, status, metadata')
          .in('lesson_id', lessonIds)
          .order('created_at', { ascending: false });

        if (lessonStatusError) {
          console.error('Error fetching lesson statuses:', lessonStatusError);
        }

        // Combine lessons with their latest status
        const lessonsWithStatus: LessonWithStatus[] = lessonsData.map((lesson) => {
          const latestStatus = lessonStatuses?.find((s) => s.lesson_id === lesson.id);
          return {
            ...lesson,
            status: latestStatus?.status,
            metadata: latestStatus?.metadata as Record<string, unknown> | null,
          };
        });

        setLessons(lessonsWithStatus);
      }
    }

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

  if (error || !outlineRequest) {
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
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-destructive">{error || 'Outline request not found'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

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
          <Button variant="outline" onClick={() => router.push('/')} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>

          {/* Outline Request Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl">{outlineRequest.title || 'Untitled'}</CardTitle>
                  <CardDescription className="mt-2">
                    Created:{' '}
                    {outlineRequest.created_at
                      ? new Date(outlineRequest.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A'}
                  </CardDescription>
                </div>
                <Badge variant={outlineRequest.status === 'completed' ? 'default' : 'secondary'}>
                  {outlineRequest.status || 'unknown'}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Lesson Outline */}
          <Card>
            <CardHeader>
              <CardTitle>Lesson Outline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">{String(outlineRequest.outline)}</p>
            </CardContent>
          </Card>

          {/* Associated Lessons */}
          {lessons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Lessons ({lessons.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lessons.map((lesson) => (
                    <Card key={lesson.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">Lesson {lesson.id.slice(0, 8)}</CardTitle>
                          <Badge variant={lesson.status === 'lesson.ready_to_use' ? 'default' : 'secondary'}>
                            {lesson.status || 'unknown'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Created: {lesson.created_at ? new Date(lesson.created_at).toLocaleString() : 'N/A'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {outlineRequest.status === 'error' && outlineRequest.metadata && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">System Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-destructive">
                  {(() => {
                    if (
                      typeof outlineRequest.metadata === 'object' &&
                      outlineRequest.metadata !== null &&
                      !Array.isArray(outlineRequest.metadata) &&
                      'message' in outlineRequest.metadata &&
                      typeof outlineRequest.metadata.message === 'string'
                    ) {
                      return outlineRequest.metadata.message || JSON.stringify(outlineRequest.metadata);
                    }
                    return JSON.stringify(outlineRequest.metadata);
                  })()}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Failed Display */}
          {outlineRequest.status === 'failed' && outlineRequest.metadata && (
            <Card className="border-yellow-500">
              <CardHeader>
                <CardTitle className="text-yellow-600">Validation Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-yellow-600">
                  {(() => {
                    if (
                      typeof outlineRequest.metadata === 'object' &&
                      outlineRequest.metadata !== null &&
                      !Array.isArray(outlineRequest.metadata) &&
                      'failureReason' in outlineRequest.metadata &&
                      typeof outlineRequest.metadata.failureReason === 'string'
                    ) {
                      return outlineRequest.metadata.failureReason;
                    }
                    return 'The outline did not meet validation requirements';
                  })()}
                </p>
                {(() => {
                  if (
                    typeof outlineRequest.metadata === 'object' &&
                    outlineRequest.metadata !== null &&
                    'details' in outlineRequest.metadata &&
                    Array.isArray(outlineRequest.metadata.details)
                  ) {
                    return (
                      <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                        {outlineRequest.metadata.details.map((detail: unknown, idx: number) => (
                          <li key={idx}>{String(detail)}</li>
                        ))}
                      </ul>
                    );
                  }
                  return null;
                })()}
              </CardContent>
            </Card>
          )}

          {/* Processing Status */}
          {outlineRequest.status !== 'completed' &&
            outlineRequest.status !== 'error' &&
            outlineRequest.status !== 'failed' &&
            outlineRequest.status !== 'outline.blocks.generated' && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-muted-foreground">Processing... ({outlineRequest.status})</p>
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
