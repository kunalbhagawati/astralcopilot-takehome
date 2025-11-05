import { createClient } from '@/lib/supabase/server';
import { processOutline } from '@/lib/services/outline-request-pipeline';
import { logger } from '@/lib/services/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  logger.info('[API] POST /api/lessons/generate - Request received');

  try {
    logger.info('[API] Parsing request body...');
    const body = await request.json();
    const { outline } = body;
    logger.info('[API] Outline received:', outline);

    // Validate input
    if (!outline || typeof outline !== 'string' || outline.trim().length === 0) {
      logger.info('[API] Validation failed: outline is required');
      return NextResponse.json({ error: 'Lesson outline is required' }, { status: 400 });
    }

    // Create Supabase client
    logger.info('[API] Creating Supabase client...');
    const supabase = await createClient();
    logger.info('[API] Supabase client created');

    // Extract a title from the outline (first 100 chars or first line)
    const title = outline.split('\n')[0].slice(0, 100).trim();
    logger.info('[API] Title extracted:', title);

    // Insert outline request record with 'submitted' status
    logger.info('[API] Inserting outline request into database...');
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
      logger.error('[API] Error creating outline request:', error);
      return NextResponse.json({ error: 'Failed to create outline request' }, { status: 500 });
    }

    logger.info('[API] Outline request created:', outlineRequest.id);

    // Trigger background processing (async, non-blocking)
    logger.info('[API] Triggering background processing...');
    processOutline(outlineRequest.id);

    // Return the created outline request immediately
    logger.info('[API] Returning success response');
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
    logger.error('[API] Error in generate endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
