import { createClient } from '@/lib/supabase/server';
import { processOutline } from '@/lib/services/outline-request-pipeline';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outline } = body;

    // Validate input
    if (!outline || typeof outline !== 'string' || outline.trim().length === 0) {
      return NextResponse.json({ error: 'Lesson outline is required' }, { status: 400 });
    }

    // Create Supabase client
    const supabase = await createClient();

    // Extract a title from the outline (first 100 chars or first line)
    const title = outline.split('\n')[0].slice(0, 100).trim();

    // Insert outline request record with 'submitted' status
    const { data: outlineRequest, error } = await supabase
      .from('outline_request')
      .insert({
        title,
        outline: outline.trim(),
        status: 'submitted',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating outline request:', error);
      return NextResponse.json({ error: 'Failed to create outline request' }, { status: 500 });
    }

    // Trigger background processing (async, non-blocking)
    processOutline(outlineRequest.id);

    // Return the created outline request immediately
    return NextResponse.json(
      {
        success: true,
        outlineRequest: {
          id: outlineRequest.id,
          title: outlineRequest.title,
          status: outlineRequest.status,
          created_at: outlineRequest.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error in generate endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
