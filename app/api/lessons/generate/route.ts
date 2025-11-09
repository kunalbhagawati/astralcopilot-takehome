import { logger } from '@/lib/services/logger';
import { OutlineRequestRepository } from '@/lib/services/repositories/outline-request.repository';
import { createClient } from '@/lib/supabase/server';
import { processOutlineWorkflow } from '@/lib/workflows/outline-workflow';
import { NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

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
      return NextResponse.json({ error: 'Lesson outline is required' }, { status: 400, headers: corsHeaders });
    }

    // Create Supabase client
    logger.info('[API] Creating Supabase client...');
    const supabase = await createClient();
    logger.info('[API] Supabase client created');

    // Extract a title from the outline (first 100 chars or first line)
    const title = outline.split('\n')[0].slice(0, 100).trim();
    logger.info('[API] Title extracted:', title);

    // Insert outline request record
    logger.info('[API] Inserting outline request into database...');
    const { data: outlineRequest, error } = await supabase
      .from('outline_request')
      .insert({
        title,
        outline: outline.trim(),
      })
      .select()
      .single();

    if (error) {
      logger.error('[API] Error creating outline request:', error);
      return NextResponse.json({ error: 'Failed to create outline request' }, { status: 500, headers: corsHeaders });
    }

    logger.info('[API] Outline request created:', outlineRequest.id);

    // Update initial status (submitted)
    logger.info('[API] Setting initial status to submitted...');
    const outlineRepo = new OutlineRequestRepository();
    try {
      await outlineRepo.updateStatus(outlineRequest.id, 'submitted', undefined);
    } catch (statusError) {
      logger.error('[API] Error updating status:', statusError);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500, headers: corsHeaders });
    }

    // Trigger workflow using Workflow DevKit's start() function
    // This properly enqueues the workflow with durability guarantees
    logger.info('[API] Triggering outline processing workflow...');

    const run = await start(processOutlineWorkflow, [
      {
        outlineRequestId: outlineRequest.id,
        outline: outlineRequest.outline,
      },
    ]);

    logger.info('[API] Workflow started with runId:', run.runId);

    // Return the created outline request immediately
    logger.info('[API] Returning success response (workflow enqueued)');
    return NextResponse.json(
      {
        success: true,
        outlineRequest: {
          id: outlineRequest.id,
          title: outlineRequest.title,
          status: 'submitted',
          created_at: outlineRequest.created_at,
        },
      },
      { status: 201, headers: corsHeaders },
    );
  } catch (error) {
    logger.error('[API] Error in generate endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
