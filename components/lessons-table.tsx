'use client';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { Tables } from '@/lib/types/database.types';
import { LessonStatus, OutlineRequest, OutlineRequestStatus } from '@/lib/types/lesson';
import { AlertCircle, XCircle } from 'lucide-react';
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
 * Extended types with status information from status tables
 */
type OutlineRequestWithStatus = OutlineRequest & {
  status?: OutlineRequestStatus;
  metadata?: Record<string, unknown> | null;
};

interface LessonWithDetails extends LessonRow {
  status?: LessonStatus;
  metadata?: Record<string, unknown> | null;
}

export function LessonsTable({ outlineRequestId, onLessonClick }: LessonsTableProps) {
  const [outlineRequest, setOutlineRequest] = useState<OutlineRequestWithStatus | null>(null);
  const [lessons, setLessons] = useState<LessonWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

  const fetchOutlineRequest = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase.from('outline_request').select('*').eq('id', outlineRequestId).single();

    if (error) {
      console.error('Error fetching outline request:', error);
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
      ...data,
      status: statusData?.status,
      metadata: statusData?.metadata as Record<string, unknown> | null,
    };

    setOutlineRequest(outlineRequestWithStatus);
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
      return;
    }

    if (lessonsData) {
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
      const lessonsWithDetails: LessonWithDetails[] = lessonsData.map((lesson) => {
        const latestStatus = lessonStatuses?.find((s) => s.lesson_id === lesson.id);
        return {
          ...lesson,
          status: latestStatus?.status,
          metadata: latestStatus?.metadata as Record<string, unknown> | null,
        };
      });

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

    // Subscribe to outline_request_status_record changes for this specific outline
    const outlineStatusChannel = supabase
      .channel(`outline-request-status-${outlineRequestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'outline_request_status_record',
          filter: `outline_request_id=eq.${outlineRequestId}`,
        },
        () => {
          console.log('Outline request status updated');
          // Refetch outline request with latest status
          fetchOutlineRequest();
        },
      )
      .subscribe();

    // Subscribe to lesson status changes and mapping changes
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
          event: '*',
          schema: 'public',
          table: 'lesson_status_record',
        },
        () => {
          // Refetch lessons when any lesson status changes
          fetchLessons();
        },
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(outlineStatusChannel);
      supabase.removeChannel(lessonsChannel);
    };
  }, [outlineRequestId, fetchOutlineRequestAndLessons, fetchLessons, fetchOutlineRequest]);

  const getOutlineStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      'submitted': { label: 'Submitted', variant: 'outline' },
      'outline.validating': { label: 'Validating Outline', variant: 'secondary' },
      'outline.validated': { label: 'Outline Validated', variant: 'outline' },
      'outline.blocks.generating': { label: 'Generating Blocks', variant: 'secondary' },
      'outline.blocks.generated': { label: 'Blocks Generated', variant: 'default' },
      'lessons.generating': { label: 'Generating Lessons', variant: 'secondary' },
      'lessons.generated': { label: 'Lessons Generated', variant: 'outline' },
      'lessons.validating': { label: 'Validating Lessons', variant: 'secondary' },
      'lessons.validated': { label: 'Lessons Validated', variant: 'outline' },
      'completed': { label: 'Completed', variant: 'default' },
      'error': { label: 'Error', variant: 'destructive' },
      'failed': { label: 'Failed', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };

    const isProcessing =
      status === 'outline.validating' ||
      status === 'outline.blocks.generating' ||
      status === 'lessons.generating' ||
      status === 'lessons.validating';

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
        {config.label}
      </Badge>
    );
  };

  const getLessonStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      'lesson.generated': { label: 'Generated', variant: 'outline' },
      'lesson.validating': { label: 'Validating', variant: 'secondary' },
      'lesson.ready_to_use': { label: 'Ready to Use', variant: 'default' },
      'error': { label: 'Error', variant: 'destructive' },
      'completed': { label: 'Completed', variant: 'default' },
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

  const handleOutlineClick = () => {
    // Open dialog to show error/failure details
    setIsErrorDialogOpen(true);
  };

  const isOutlineClickable = outlineRequest?.status === 'error' || outlineRequest?.status === 'failed';

  return (
    <div className="space-y-6">
      {/* Outline Request Status */}
      <div
        className={`flex items-center justify-between p-4 border rounded-lg bg-muted/50 ${
          isOutlineClickable ? 'cursor-pointer hover:bg-muted transition-colors' : ''
        }`}
        onClick={isOutlineClickable ? handleOutlineClick : undefined}
        role={isOutlineClickable ? 'button' : undefined}
        tabIndex={isOutlineClickable ? 0 : undefined}
        onKeyDown={
          isOutlineClickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOutlineClick();
                }
              }
            : undefined
        }>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Outline Status</h3>
          <p className="text-sm text-muted-foreground">{outlineRequest.title || 'Untitled'}</p>
          {isOutlineClickable && <p className="text-xs text-muted-foreground mt-1 italic">Click to view details</p>}
        </div>
        <div>{outlineRequest.status && getOutlineStatusBadge(outlineRequest.status)}</div>
      </div>

      {/* Lessons Table */}
      {lessons.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          {outlineRequest.status === 'completed' ||
          outlineRequest.status === 'error' ||
          outlineRequest.status === 'failed'
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

      {/* Error/Failed Dialog */}
      <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {outlineRequest?.status === 'error' ? (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  System Error
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Validation Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {outlineRequest?.status === 'error'
                ? 'A technical error occurred while processing your outline.'
                : 'Your outline did not meet the validation requirements.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {outlineRequest?.status === 'error' && outlineRequest?.metadata && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Error Details:</p>
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm text-destructive">
                    {(() => {
                      const metadata = outlineRequest.metadata;
                      if (
                        typeof metadata === 'object' &&
                        metadata !== null &&
                        'message' in metadata &&
                        typeof metadata.message === 'string'
                      ) {
                        return metadata.message;
                      }
                      return JSON.stringify(metadata);
                    })()}
                  </p>
                </div>
              </div>
            )}

            {outlineRequest?.status === 'failed' && outlineRequest?.metadata && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Reason:</p>
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      {(() => {
                        const metadata = outlineRequest.metadata;
                        if (
                          typeof metadata === 'object' &&
                          metadata !== null &&
                          'failureReason' in metadata &&
                          typeof metadata.failureReason === 'string'
                        ) {
                          return metadata.failureReason;
                        }
                        return 'The outline did not meet validation requirements';
                      })()}
                    </p>
                  </div>
                </div>

                {(() => {
                  const metadata = outlineRequest.metadata;
                  if (
                    typeof metadata === 'object' &&
                    metadata !== null &&
                    'details' in metadata &&
                    Array.isArray(metadata.details) &&
                    metadata.details.length > 0
                  ) {
                    return (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Details:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                          {metadata.details.map((detail: unknown, idx: number) => (
                            <li key={idx}>{String(detail)}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
