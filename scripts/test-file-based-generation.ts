/**
 * Test Script: File-Based Lesson Generation POC
 *
 * Demonstrates the new architecture:
 * 1. Generate a full Next.js page (with 'use client')
 * 2. Validate the page
 * 3. Compile and write to ./tmp/generated/{lessonId}/
 * 4. Verify files were created
 *
 * Run: NODE_ENV=development bun scripts/test-file-based-generation.ts
 */

import { compileAndWriteTSX } from '../lib/services/compilation/tsx-compiler';
import { validateTSX } from '../lib/services/validation/tsx-validation-orchestrator';
import { promises as fs } from 'fs';

const log = console.log;

/**
 * Sample full Next.js page (what LLM would generate)
 */
const SAMPLE_FULL_PAGE = `'use client';
import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export default function LessonPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const correctAnswer = "12";

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Text Block */}
        <article className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-blue-700 mb-4">
            Multiplication Quiz
          </h1>
          <p className="text-lg text-gray-700 leading-relaxed">
            Test your knowledge of multiplication!
          </p>
        </article>

        {/* Quiz Block */}
        <article className="bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-blue-700 mb-4">
            What is 3 x 4?
          </h3>
          <div className="space-y-3">
            {['6', '9', '12', '15'].map((option) => (
              <label
                key={option}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="quiz"
                  checked={selected === option}
                  onChange={() => setSelected(option)}
                  className="w-5 h-5"
                />
                <span className="text-lg">{option}</span>
              </label>
            ))}
          </div>
          {selected && (
            <div className={\`mt-4 p-4 rounded-lg flex items-center space-x-2 \${
              selected === correctAnswer
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }\`}>
              {selected === correctAnswer ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
              <span className="font-medium">
                {selected === correctAnswer ? 'Correct!' : 'Try again!'}
              </span>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}`;

async function main() {
  log('🚀 Testing File-Based Lesson Generation');
  log('═'.repeat(80));
  log('');

  const testLessonId = 'test-' + Date.now();

  log(`📝 Test Lesson ID: ${testLessonId}`);
  log('');

  // Step 1: Validate the full page
  log('Step 1: Validating full page TSX...');
  log('─'.repeat(80));
  const validationResult = await validateTSX(SAMPLE_FULL_PAGE);

  if (!validationResult.valid) {
    log('❌ Validation FAILED:');
    validationResult.errors.forEach((err, idx) => {
      log(`  ${idx + 1}. [${err.type}] Line ${err.line}:${err.column}`);
      log(`     ${err.message}`);
    });
    log('');
    log('⚠️  Fix validation errors before proceeding.');
    process.exit(1);
  }

  log('✅ Validation passed!');
  log('');

  // Step 2: Compile and write files
  log('Step 2: Compiling and writing files...');
  log('─'.repeat(80));

  try {
    const { tsxPath, jsPath } = await compileAndWriteTSX(SAMPLE_FULL_PAGE, testLessonId);

    log(`✅ TSX source written: ${tsxPath}`);
    log(`✅ Compiled JS written: ${jsPath}`);
    log('');

    // Step 3: Verify files exist and are readable
    log('Step 3: Verifying files...');
    log('─'.repeat(80));

    const tsxContent = await fs.readFile(tsxPath, 'utf-8');
    const jsContent = await fs.readFile(jsPath, 'utf-8');

    log(`✅ TSX file size: ${tsxContent.length} bytes`);
    log(`✅ JS file size: ${jsContent.length} bytes`);
    log('');

    // Show preview of compiled JS
    log('📄 Compiled JavaScript Preview (first 500 chars):');
    log('─'.repeat(80));
    log(jsContent.substring(0, 500) + '...');
    log('');

    // Step 4: Success summary
    log('═'.repeat(80));
    log('✅ SUCCESS! File-based generation working');
    log('═'.repeat(80));
    log('');
    log('Next steps:');
    log('  1. Start the dev server: bun run dev');
    log(`  2. Visit: http://localhost:3000/lessons/${testLessonId}`);
    log('  3. The page should dynamically load and render!');
    log('');
    log(`📁 Generated files location: ./tmp/generated/${testLessonId}/`);
    log('');
  } catch (error) {
    log('❌ ERROR during compilation/writing:');
    log(error);
    process.exit(1);
  }
}

main().catch(console.error);
