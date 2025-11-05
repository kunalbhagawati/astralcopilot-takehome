'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { OutlineRequest, OutlineRequestStatus } from '@/lib/types/lesson';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { LessonsTable } from './lessons-table';

/**
 * Component: OutlineAccordion (Client Component)
 * Purpose: Display all outline requests in an accordion with lazy-loaded lessons
 *
 * Using @radix-ui/react-accordion v1.2.2 via shadcn/ui
 * Reference: https://ui.shadcn.com/docs/components/accordion
 */

interface OutlineAccordionProps {
  defaultOpenId?: string | null;
  /**
   * Callback when a lesson is clicked. Receives the lesson ID.
   * This allows navigation to the individual lesson page.
   */
  onLessonClick?: (lessonId: string) => void;
}

/**
 * Extended outline request type with status information
 */
type OutlineRequestWithStatus = OutlineRequest & {
  status?: OutlineRequestStatus;
  metadata?: Record<string, unknown> | null;
};

export const OutlineAccordion = ({ defaultOpenId, onLessonClick }: OutlineAccordionProps) => {
  const [outlineRequests, setOutlineRequests] = useState<OutlineRequestWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openItems, setOpenItems] = useState<string[]>([]);

  /**
   * Fetch all outline requests with their latest status
   */
  const fetchOutlineRequests = useCallback(async () => {
    const supabase = createClient();

    // Fetch all outline requests ordered by most recent first
    const { data: outlines, error: outlinesError } = await supabase
      .from('outline_request')
      .select('*')
      .order('created_at', { ascending: false });

    if (outlinesError) {
      console.error('Error fetching outline requests:', outlinesError);
      return;
    }

    if (!outlines || outlines.length === 0) {
      setOutlineRequests([]);
      return;
    }

    // Fetch latest status for each outline request
    const outlineIds = outlines.map((outline) => outline.id);
    const { data: statusData, error: statusError } = await supabase
      .from('outline_request_status_record')
      .select('outline_request_id, status, metadata')
      .in('outline_request_id', outlineIds)
      .order('created_at', { ascending: false });

    if (statusError) {
      console.error('Error fetching outline statuses:', statusError);
    }

    // Combine outline requests with their latest status
    const outlinesWithStatus: OutlineRequestWithStatus[] = outlines.map((outline) => {
      const latestStatus = statusData?.find((s) => s.outline_request_id === outline.id);
      return {
        ...outline,
        status: latestStatus?.status,
        metadata: latestStatus?.metadata as Record<string, unknown> | null,
      };
    });

    setOutlineRequests(outlinesWithStatus);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchOutlineRequests();
      setIsLoading(false);
    };

    loadData();

    // Set up Realtime subscription for new outline requests and status changes
    const supabase = createClient();

    const outlineChannel = supabase
      .channel('outline-requests-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'outline_request',
        },
        () => {
          console.log('Outline request changed, refetching...');
          fetchOutlineRequests();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'outline_request_status_record',
        },
        () => {
          console.log('Outline request status changed, refetching...');
          fetchOutlineRequests();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(outlineChannel);
    };
  }, [fetchOutlineRequests]);

  /**
   * Auto-expand the default open item if provided
   */
  useEffect(() => {
    if (defaultOpenId && outlineRequests.some((req) => req.id === defaultOpenId)) {
      setOpenItems([defaultOpenId]);
    }
  }, [defaultOpenId, outlineRequests]);

  /**
   * Get status badge for outline request
   * Reuses logic from LessonsTable component
   */
  const getOutlineStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      'submitted': { label: 'Submitted', variant: 'outline' },
      'outline.validating': { label: 'Validating', variant: 'secondary' },
      'outline.validated': { label: 'Validated', variant: 'outline' },
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

  /**
   * Format date for display
   */
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

  if (outlineRequests.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No outline requests found. Generate your first lesson above!
      </div>
    );
  }

  return (
    <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="w-full">
      {outlineRequests.map((outline) => (
        <AccordionItem key={outline.id} value={outline.id}>
          <AccordionTrigger className="hover:no-underline">
            <div className="flex flex-col items-start gap-2 w-full pr-4">
              <div className="flex items-center justify-between w-full">
                <h3 className="font-semibold text-sm text-left">{outline.title || 'Untitled Outline'}</h3>
                {outline.status && getOutlineStatusBadge(outline.status)}
              </div>
              <p className="text-xs text-muted-foreground">Created {formatDate(outline.created_at || '')}</p>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {/* Lazy-load LessonsTable only when accordion item is expanded */}
            <div className="pt-4">
              <LessonsTable outlineRequestId={outline.id} onLessonClick={onLessonClick} />
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
