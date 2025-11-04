'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { Tables } from '@/lib/types/database.types';
import { OutlineRequest } from '@/lib/types/lesson';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface LessonsTableProps {
  outlineRequestId: string;
  onLessonClick?: (lessonId: string) => void;
}

type LessonRow = Tables<'lesson'>;

interface LessonWithDetails extends LessonRow {
  title?: string;
}

export function LessonsTable({ outlineRequestId, onLessonClick }: LessonsTableProps) {
  const [outlineRequest, setOutlineRequest] = useState<OutlineRequest | null>(null);
  const [lessons, setLessons] = useState<LessonWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOutlineRequest = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase.from('outline_request').select('*').eq('id', outlineRequestId).single();

    if (error) {
      console.error('Error fetching outline request:', error);
    } else {
      setOutlineRequest(data);
    }
  }, [outlineRequestId]);

  const fetchLessons = useCallback(async () => {
    const supabase = createClient();

    // First, get lesson IDs from the mapping table
    const { data: mappingData, error: mappingError } = await supabase
      .from('mapping_outline_request_lesson')
      .select('lesson_id')
      .eq('outline_request_id', outlineRequestId);

    if (mappingError) {
      console.error('Error fetching lesson mappings:', mappingError);
      return;
    }

    if (!mappingData || mappingData.length === 0) {
      setLessons([]);
      return;
    }

    // Get the lesson IDs
    const lessonIds = mappingData.map((item) => item.lesson_id);

    // Now fetch the actual lessons
    const { data: lessonsData, error: lessonsError } = await supabase.from('lesson').select('*').in('id', lessonIds);

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
    } else if (lessonsData) {
      // Add title to each lesson
      const lessonsWithDetails: LessonWithDetails[] = lessonsData.map((lesson) => ({
        ...lesson,
        title: (lesson.content as { title?: string } | null)?.title || 'Untitled Lesson',
      }));
      setLessons(lessonsWithDetails);
    }
  }, [outlineRequestId]);

  const fetchOutlineRequestAndLessons = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchOutlineRequest(), fetchLessons()]);
    setIsLoading(false);
  }, [fetchOutlineRequest, fetchLessons]);

  useEffect(() => {
    fetchOutlineRequestAndLessons();

    // Set up Realtime subscriptions
    const supabase = createClient();

    // Subscribe to outline_request changes for this specific outline
    const outlineChannel = supabase
      .channel(`outline-request-${outlineRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'outline_request',
          filter: `id=eq.${outlineRequestId}`,
        },
        (payload) => {
          console.log('Outline request updated:', payload);
          setOutlineRequest(payload.new as OutlineRequest);
        },
      )
      .subscribe();

    // Subscribe to lesson changes via the mapping table
    const lessonsChannel = supabase
      .channel(`lessons-${outlineRequestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mapping_outline_request_lesson',
          filter: `outline_request_id=eq.${outlineRequestId}`,
        },
        () => {
          // Refetch lessons when mapping changes
          fetchLessons();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lesson',
        },
        (payload) => {
          // Update specific lesson when it changes
          const updatedLesson = payload.new as LessonRow;
          setLessons((prev) =>
            prev.map((lesson) =>
              lesson.id === updatedLesson.id
                ? {
                    ...updatedLesson,
                    title: (updatedLesson.content as { title?: string } | null)?.title || 'Untitled Lesson',
                  }
                : lesson,
            ),
          );
        },
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(outlineChannel);
      supabase.removeChannel(lessonsChannel);
    };
  }, [outlineRequestId, fetchOutlineRequestAndLessons, fetchLessons]);

  const getOutlineStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      submitted: { label: 'Submitted', variant: 'outline' },
      validating_outline: { label: 'Validating Outline', variant: 'secondary' },
      generating_lessons: { label: 'Generating Lessons', variant: 'secondary' },
      validating_lessons: { label: 'Validating Lessons', variant: 'secondary' },
      completed: { label: 'Completed', variant: 'default' },
      error: { label: 'Error', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {(status === 'validating_outline' || status === 'generating_lessons' || status === 'validating_lessons') && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {config.label}
      </Badge>
    );
  };

  const getLessonStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      generated: { label: 'Generated', variant: 'outline' },
      validating: { label: 'Validating', variant: 'secondary' },
      ready_to_use: { label: 'Ready to Use', variant: 'default' },
      error: { label: 'Error', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {status === 'validating' && <Loader2 className="h-3 w-3 animate-spin" />}
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!outlineRequest) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">Outline request not found. Please try again.</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Outline Request Status */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Outline Status</h3>
          <p className="text-sm text-muted-foreground">{outlineRequest.title || 'Untitled'}</p>
        </div>
        <div>{getOutlineStatusBadge(outlineRequest.status)}</div>
      </div>

      {/* Lessons Table */}
      {lessons.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          {outlineRequest.status === 'completed'
            ? 'No lessons found for this outline.'
            : 'Lessons are being generated...'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lesson Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map((lesson) => (
              <TableRow
                key={lesson.id}
                onClick={() => {
                  if (lesson.status === 'ready_to_use' && onLessonClick) {
                    onLessonClick(lesson.id);
                  }
                }}
                className={lesson.status === 'ready_to_use' ? 'cursor-pointer hover:bg-muted/80' : 'cursor-default'}>
                <TableCell className="font-medium">{lesson.title}</TableCell>
                <TableCell>{getLessonStatusBadge(lesson.status)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(lesson.created_at || '')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
