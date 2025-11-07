/**
 * Lesson Layout with Navigation
 *
 * Server Component that provides navigation between lessons.
 * Uses same styling as home page for consistency.
 */

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { notFound } from 'next/navigation';

interface LessonLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
}

export default async function LessonLayout({ children, params }: LessonLayoutProps) {
  const { id: lessonId } = await params;

  // Fetch current lesson to get outline_request_id
  const supabase = await createClient();
  const { data: currentLesson, error: currentError } = await supabase
    .from('lesson')
    .select('id, title, outline_request_id, created_at')
    .eq('id', lessonId)
    .single();

  if (currentError || !currentLesson) {
    notFound();
  }

  // Fetch all lessons for this outline request, ordered by creation
  const { data: allLessons, error: lessonsError } = await supabase
    .from('lesson')
    .select('id, title, created_at')
    .eq('outline_request_id', currentLesson.outline_request_id)
    .order('created_at', { ascending: true });

  if (lessonsError || !allLessons) {
    // If we can't fetch lessons, just render without navigation
    return <div className="min-h-screen">{children}</div>;
  }

  // Find current lesson index
  const currentIndex = allLessons.findIndex((lesson) => lesson.id === lessonId);
  const previousLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Same nav bar as home page */}
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
          <div className="flex gap-5 items-center font-semibold">
            <Link href={'/'}>Lesson Generator</Link>
          </div>
          <ThemeSwitcher />
        </div>
      </nav>

      {/* Main content area - same layout as home page */}
      <div className="flex-1 w-full flex flex-col items-center p-5">
        <div className="w-full max-w-5xl flex flex-col gap-8">{children}</div>
      </div>

      {/* Footer with navigation - same style as home page footer */}
      <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
        {previousLesson ? (
          <Link href={`/lessons/${previousLesson.id}`} className="text-muted-foreground hover:text-foreground">
            Previous
          </Link>
        ) : (
          <span className="text-muted-foreground/50 cursor-not-allowed">Previous</span>
        )}

        <span className="text-muted-foreground">|</span>

        <Link href="/" className="text-muted-foreground hover:text-foreground">
          Back to Outline
        </Link>

        <span className="text-muted-foreground">|</span>

        {nextLesson ? (
          <Link href={`/lessons/${nextLesson.id}`} className="text-muted-foreground hover:text-foreground">
            Next
          </Link>
        ) : (
          <span className="text-muted-foreground/50 cursor-not-allowed">Next</span>
        )}
      </footer>
    </main>
  );
}
