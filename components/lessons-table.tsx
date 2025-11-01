'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OutlineRequest } from '@/lib/types/lesson';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface LessonsTableProps {
  onLessonClick?: (outlineRequestId: string) => void;
}

export function LessonsTable({ onLessonClick }: LessonsTableProps) {
  const [outlineRequests, setOutlineRequests] = useState<OutlineRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOutlineRequests();

    // Set up Realtime subscription
    const supabase = createClient();
    const channel = supabase
      .channel('outline-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'outline_request',
        },
        (payload) => {
          console.log('Realtime update:', payload);

          if (payload.eventType === 'INSERT') {
            // Add new outline request to the list
            setOutlineRequests((prev) => [payload.new as OutlineRequest, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            // Update existing outline request
            setOutlineRequests((prev) =>
              prev.map((request) => (request.id === payload.new.id ? (payload.new as OutlineRequest) : request)),
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted outline request
            setOutlineRequests((prev) => prev.filter((request) => request.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOutlineRequests = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('outline_request')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching outline requests:', error);
    } else {
      setOutlineRequests(data || []);
    }

    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      submitted: { label: 'Submitted', variant: 'outline' },
      validating_outline: { label: 'Validating Outline', variant: 'secondary' },
      generating_lesson: { label: 'Generating Lesson', variant: 'secondary' },
      validating_lessons: { label: 'Validating Lessons', variant: 'secondary' },
      completed: { label: 'Completed', variant: 'default' },
      error: { label: 'Error', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {(status === 'validating_outline' || status === 'generating_lesson' || status === 'validating_lessons') && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
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

  if (outlineRequests.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No lessons yet. Generate your first lesson above!
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {outlineRequests.map((request) => (
          <TableRow
            key={request.id}
            onClick={() => {
              if (request.status === 'completed' && onLessonClick) {
                onLessonClick(request.id);
              }
            }}
            className={request.status === 'completed' ? 'cursor-pointer hover:bg-muted/80' : 'cursor-default'}>
            <TableCell className="font-medium">{request.title || 'Untitled'}</TableCell>
            <TableCell>{getStatusBadge(request.status)}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(request.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
