'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LessonsTable } from '@/components/lessons-table';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const tableRef = useRef<{ refresh: () => void }>(null);
  const [outline, setOutline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!outline.trim()) {
      setError('Please enter a lesson outline');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/lessons/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ outline }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate lesson');
      }

      setSuccess('Lesson generation started!');
      setOutline('');

      // Trigger table refresh
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLessonClick = (lessonId: string) => {
    router.push(`/lessons/${lessonId}`);
  };

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
        <div className="w-full max-w-5xl flex flex-col gap-8">
          {/* Generation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Generate a New Lesson</CardTitle>
              <CardDescription>Enter a lesson outline to generate a structured lesson</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="outline">Lesson Outline</Label>
                  <Textarea
                    id="outline"
                    value={outline}
                    onChange={(e) => setOutline(e.target.value)}
                    placeholder="e.g., A 10 question pop quiz on Florida"
                    className="min-h-[120px]"
                    disabled={isSubmitting}
                  />
                </div>

                {error && <div className="text-sm text-destructive">{error}</div>}

                {success && <div className="text-sm text-green-600 dark:text-green-400">{success}</div>}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Generating...' : 'Generate'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lessons Table */}
          <Card>
            <CardHeader>
              <CardTitle>Your Lessons</CardTitle>
              <CardDescription>View and manage your generated lessons</CardDescription>
            </CardHeader>
            <CardContent>
              <LessonsTable key={refreshKey} onLessonClick={handleLessonClick} />
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
        <p className="text-muted-foreground">Powered by Supabase & Next.js</p>
      </footer>
    </main>
  );
}
