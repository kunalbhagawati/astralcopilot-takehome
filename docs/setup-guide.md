# Setup Guide - Lesson Generator

## Prerequisites

- Supabase project created
- Environment variables configured (`.env.local`)
- Bun installed

## Step 1: Configure Environment Variables

Make sure your `.env.local` file has:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

## Step 2: Run Database Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20250130000000_create_lessons_table.sql`
5. Paste into the SQL editor
6. Click **Run** or press `Cmd/Ctrl + Enter`
7. Verify success - you should see "Success. No rows returned"

### Option 2: Supabase CLI

```bash
supabase db push
```

### Verify the Migration

Run this query in the SQL Editor:

```sql
SELECT * FROM lessons LIMIT 1;
```

You should see an empty result with the correct column structure.

## Step 3: Verify Realtime is Enabled

In the SQL Editor, run:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

You should see the `lessons` table listed. If not, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE lessons;
```

## Step 4: Install Dependencies (if needed)

```bash
bun install
```

## Step 5: Start Development Server

```bash
bun run dev
```

The app should be running at `http://localhost:3000`

## Step 6: Test the Application

### Test 1: Generate a Lesson

1. Visit `http://localhost:3000`
2. Enter in the textarea: "A 10 question pop quiz on Florida"
3. Click "Generate"
4. You should see:
   - Success message appears
   - New lesson appears in the table with "Pending" status
   - Status updates to "Validating" (with spinner)
   - Status updates to "Structuring" (with spinner)
   - Status updates to "Completed" (green badge)
   - All updates happen automatically without page refresh

### Test 2: View a Lesson

1. Click on a completed lesson in the table
2. You should be navigated to `/lessons/[id]`
3. You should see:
   - Lesson title and metadata
   - Original outline
   - Generated content with sections
   - Difficulty and estimated time badges

### Test 3: Real-time Updates

1. Open the app in two browser windows/tabs
2. Generate a lesson in one window
3. Watch the table update automatically in the second window
4. No refresh required!

## Troubleshooting

### Issue: Lessons table doesn't show any data

**Solution**: Check browser console for errors. Verify Supabase connection:

```javascript
// In browser console:
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

### Issue: Real-time updates not working

**Solution**:

1. Verify Realtime is enabled in Supabase dashboard:
   - Go to Database → Replication
   - Ensure `lessons` table is in the publication
2. Check browser console for subscription errors
3. Ensure RLS policies are set correctly

### Issue: Lesson status stuck on "Pending"

**Solution**:

1. Check server console for errors
2. Verify the state machine service is running:
   - Look for console logs in the terminal running `bun run dev`
3. Check Supabase logs for database errors

### Issue: "Failed to create lesson" error

**Solution**:

1. Verify RLS policies are created
2. Check that the `lessons` table exists
3. Verify environment variables are correct

## Database Schema Reference

```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  outline TEXT NOT NULL,
  content JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Development Tips

### Viewing Real-time Logs

The `LessonsTable` component logs all Realtime events to the browser console:

```javascript
console.log("Realtime update:", payload);
```

### Testing State Transitions

The dummy services have built-in delays:

- Validation: 1.5 seconds
- Structuring: 2 seconds
- Total generation time: ~3.5 seconds

You can modify these in:

- `lib/services/adapters/outline-validator.ts`
- `lib/services/adapters/lesson-structurer.ts`

### Inspecting Generated Content

View the generated content structure in the browser console or by querying:

```sql
SELECT id, title, status, content FROM lessons WHERE status = 'completed';
```

## Next Steps

Now that the basic system is working, you can:

1. Replace dummy services with real AI integration
2. Customize the lesson content structure
3. Add more validation rules
4. Implement user-specific lessons (add auth)
5. Add lesson editing capabilities
6. Build analytics dashboard

## Need Help?

- Check the implementation summary: `docs/implementation-summary.md`
- Review the Supabase documentation: <https://supabase.com/docs>
- Check Next.js documentation: <https://nextjs.org/docs>
