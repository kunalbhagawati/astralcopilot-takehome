'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { Tables } from '@/lib/types/database.types';
import { LessonStatus, OutlineRequest, OutlineRequestStatus } from '@/lib/types/lesson';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface LessonsTableProps {
  outlineRequestId: string;
  /**
   * Callback when a lesson is clicked. Receives the lesson ID.
   * This allows navigation to the individual lesson page.
   */
  onLessonClick?: (lessonId: string) => void;
}

type LessonRow = Tables<'lesson'>;

/**
 * Extended types with derived status information from timestamps
 */
type OutlineRequestWithStatus = OutlineRequest & {
  status?: OutlineRequestStatus;
};

interface LessonWithDetails extends LessonRow {
  status?: LessonStatus;
}

/**
 * Derive outline request status from timestamp columns
 * Returns the latest non-null status based on timestamp order
 */
const deriveOutlineStatus = (outline: OutlineRequest): OutlineRequestStatus => {
  const timestamps: Array<{ status: OutlineRequestStatus; timestamp: string | null }> = [
    { status: 'failed', timestamp: outline.failed_at },
    { status: 'error', timestamp: outline.error_at },
    { status: 'outline.blocks.generated', timestamp: outline.outline_blocks_generated_at },
    { status: 'outline.blocks.generating', timestamp: outline.outline_blocks_generating_at },
    { status: 'outline.validated', timestamp: outline.outline_validated_at },
    { status: 'outline.validating', timestamp: outline.outline_validating_at },
    { status: 'submitted', timestamp: outline.submitted_at },
  ];

  const latest = timestamps.find((t) => t.timestamp !== null);
  return latest?.status || 'submitted';
};

/**
 * Derive lesson status from timestamp columns
 * Returns the latest non-null status based on timestamp order
 */
const deriveLessonStatus = (lesson: LessonRow): LessonStatus => {
  const timestamps: Array<{ status: LessonStatus; timestamp: string | null }> = [
    { status: 'failed', timestamp: lesson.failed_at },
    { status: 'error', timestamp: lesson.error_at },
    { status: 'lesson.compiled', timestamp: lesson.lesson_compiled_at },
    { status: 'lesson.validating', timestamp: lesson.lesson_validating_at },
    { status: 'lesson.generated', timestamp: lesson.lesson_generated_at },
  ];

  const latest = timestamps.find((t) => t.timestamp !== null);
  return latest?.status || 'lesson.generated';
};

export function LessonsTable({ outlineRequestId, onLessonClick }: LessonsTableProps) {
  const [outlineRequest, setOutlineRequest] = useState<OutlineRequestWithStatus | null>(null);
  const [lessons, setLessons] = useState<LessonWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOutlineRequest = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase.from('outline_request').select('*').eq('id', outlineRequestId).single();

    if (error) {
      console.error('Error fetching outline request:', error);
      return;
    }

    // Derive status from timestamp columns
    const outlineRequestWithStatus: OutlineRequestWithStatus = {
      ...data,
      status: deriveOutlineStatus(data),
    };

    setOutlineRequest(outlineRequestWithStatus);
  }, [outlineRequestId]);

  const fetchLessons = useCallback(async () => {
    const supabase = createClient();

    // Query lessons directly by outline_request_id
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lesson')
      .select('*')
      .eq('outline_request_id', outlineRequestId);

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
      return;
    }

    if (!lessonsData || lessonsData.length === 0) {
      setLessons([]);
      return;
    }

    // Derive status from timestamp columns for each lesson
    const lessonsWithDetails: LessonWithDetails[] = lessonsData.map((lesson) => ({
      ...lesson,
      status: deriveLessonStatus(lesson),
    }));

    setLessons(lessonsWithDetails);
  }, [outlineRequestId]);

  const fetchOutlineRequestAndLessons = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchOutlineRequest(), fetchLessons()]);
    setIsLoading(false);
  }, [fetchOutlineRequest, fetchLessons]);

  useEffect(() => {
    fetchOutlineRequestAndLessons();

    // Set up Realtime subscriptions
    // Status is tracked via timestamp columns on parent tables
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
        () => {
          console.log('Outline request updated');
          fetchOutlineRequest();
        },
      )
      .subscribe();

    // Subscribe to lesson changes
    const lessonsChannel = supabase
      .channel(`lessons-${outlineRequestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lesson',
          filter: `outline_request_id=eq.${outlineRequestId}`,
        },
        () => {
          // Refetch lessons when any lesson for this outline is inserted or updated
          fetchLessons();
        },
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(outlineChannel);
      supabase.removeChannel(lessonsChannel);
    };
  }, [outlineRequestId, fetchOutlineRequestAndLessons, fetchLessons, fetchOutlineRequest]);

  const getLessonStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      'lesson.generated': { label: 'Generated', variant: 'outline' },
      'lesson.validating': { label: 'Validating', variant: 'secondary' },
      'lesson.compiled': { label: 'Compiled', variant: 'default' },
      'error': { label: 'Error', variant: 'destructive' },
      'failed': { label: 'Failed', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {status === 'lesson.validating' && <Loader2 className="h-3 w-3 animate-spin" />}
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
      {/* Lessons Table */}
      {lessons.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          {outlineRequest?.status === 'outline.blocks.generated'
            ? 'Lessons will appear shortly...'
            : 'Outline is being processed...'}
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
                  if (onLessonClick) {
                    onLessonClick(lesson.id);
                  }
                }}
                className="cursor-pointer hover:bg-muted/80">
                <TableCell className="font-medium">{lesson.title || 'Untitled Lesson'}</TableCell>
                <TableCell>{lesson.status && getLessonStatusBadge(lesson.status)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(lesson.created_at || '')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
