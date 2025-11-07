/**
 * Dynamic Lesson Page Loader
 *
 * This is a Server Component that dynamically imports generated lesson pages
 * from the file system. Each lesson is compiled and written to:
 * ./tmp/generated/{lessonId}/page.js
 *
 * We use dynamic import() to load the compiled page at runtime.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function LessonPage({ params }: PageProps) {
  const { id: lessonId } = params;

  // Fetch lesson from database with compiled file path
  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from('lesson')
    .select('id, title, created_at, compiled_file_path')
    .eq('id', lessonId)
    .single();

  if (error || !lesson) {
    console.error('Lesson not found:', error);
    notFound();
  }

  // Get compiled file path from database
  const generatedPagePath = lesson.compiled_file_path;

  // Check if compiled file path exists
  if (!generatedPagePath) {
    console.error('Lesson has no compiled file path');
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Lesson Not Ready</h1>
          <p className="text-gray-700 mb-4">This lesson has not been compiled yet. It may still be generating.</p>
          <div className="bg-gray-100 rounded p-4 mb-4">
            <p className="text-sm font-mono text-gray-800">Lesson ID: {lessonId}</p>
          </div>
          <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  try {
    // Dynamic import the generated page
    // Use file:// protocol for absolute path imports
    const fileUrl = `file://${generatedPagePath}`;
    const lessonModule = await import(fileUrl);

    // The generated page exports: export default function LessonPage() { ... }
    const GeneratedLessonPage = lessonModule.default;

    if (!GeneratedLessonPage) {
      throw new Error('Generated page has no default export');
    }

    // Render the dynamically imported lesson page
    return <GeneratedLessonPage />;
  } catch (loadError) {
    console.error('Failed to load generated lesson page:', loadError);

    // Return error page
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Failed to Load Lesson</h1>
          <p className="text-gray-700 mb-4">The lesson page could not be loaded. This might be because:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
            <li>The lesson has not been compiled yet</li>
            <li>The compiled file is missing from the file system</li>
            <li>There was an error during lesson generation</li>
          </ul>
          <div className="bg-gray-100 rounded p-4 mb-4">
            <p className="text-sm font-mono text-gray-800">Lesson ID: {lessonId}</p>
            <p className="text-sm font-mono text-gray-800">Expected path: {generatedPagePath}</p>
          </div>
          <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }
}
