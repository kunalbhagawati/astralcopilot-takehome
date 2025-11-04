import { createClient } from '@/lib/supabase/server';
import { processOutline } from '@/lib/services/outline-request-pipeline';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[API] POST /api/lessons/generate - Request received');

  try {
    console.log('[API] Parsing request body...');
    const body = await request.json();
    const { outline } = body;
    console.log('[API] Outline received:', outline);

    // Validate input
    if (!outline || typeof outline !== 'string' || outline.trim().length === 0) {
      console.log('[API] Validation failed: outline is required');
      return NextResponse.json({ error: 'Lesson outline is required' }, { status: 400 });
    }

    // Create Supabase client
    console.log('[API] Creating Supabase client...');
    const supabase = await createClient();
    console.log('[API] Supabase client created');

    // Extract a title from the outline (first 100 chars or first line)
    const title = outline.split('\n')[0].slice(0, 100).trim();
    console.log('[API] Title extracted:', title);

    // Insert outline request record with 'submitted' status
    console.log('[API] Inserting outline request into database...');
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
      console.error('[API] Error creating outline request:', error);
      return NextResponse.json({ error: 'Failed to create outline request' }, { status: 500 });
    }

    console.log('[API] Outline request created:', outlineRequest.id);

    // Trigger background processing (async, non-blocking)
    console.log('[API] Triggering background processing...');
    processOutline(outlineRequest.id);

    // Return the created outline request immediately
    console.log('[API] Returning success response');
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
    console.error('[API] Error in generate endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
