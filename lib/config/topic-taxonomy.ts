/**
 * Topic taxonomy configuration
 *
 * Predefined mapping of topics to domains.
 * This data structure is injected into LLM system prompts to guide topic classification.
 *
 * Structure: topic → domains[]
 * - topic: Specific learning topic (e.g., "React Hooks")
 * - domains: Related domain categories (e.g., ["web-development", "javascript"])
 */

/**
 * Predefined topic-to-domains mapping for K-10 Education (Ages 5-16)
 *
 * Guidelines for adding topics:
 * - Topics should be age-appropriate for classes 1-10 (ages 5-16)
 * - Topics should be learnable in a single lesson
 * - Domains should be broad categories that help contextualize the topic
 * - Topics are organized by subject and complexity level
 */
export const TOPIC_TAXONOMY: Record<string, string[]> = {
  // === MATHEMATICS: Arithmetic (Classes 1-5) ===
  'Addition': ['math', 'arithmetic', 'basic-operations'],
  'Subtraction': ['math', 'arithmetic', 'basic-operations'],
  'Multiplication': ['math', 'arithmetic', 'basic-operations'],
  'Division': ['math', 'arithmetic', 'basic-operations'],
  'Place Value': ['math', 'arithmetic', 'number-sense'],
  'Number Patterns': ['math', 'arithmetic', 'patterns'],
  'Skip Counting': ['math', 'arithmetic', 'counting'],
  'Rounding': ['math', 'arithmetic', 'estimation'],

  // === MATHEMATICS: Fractions & Decimals (Classes 3-7) ===
  'Fractions': ['math', 'arithmetic', 'rational-numbers'],
  'Decimals': ['math', 'arithmetic', 'rational-numbers'],
  'Percentages': ['math', 'arithmetic', 'rational-numbers'],
  'Ratios': ['math', 'arithmetic', 'proportions'],
  'Proportions': ['math', 'arithmetic', 'proportions'],
  'Comparing Fractions': ['math', 'arithmetic', 'rational-numbers'],

  // === MATHEMATICS: Algebra (Classes 6-10) ===
  'Variables': ['math', 'algebra', 'expressions'],
  'Simple Equations': ['math', 'algebra', 'equations'],
  'Linear Equations': ['math', 'algebra', 'equations'],
  'Exponents': ['math', 'algebra', 'powers'],
  'Square Roots': ['math', 'algebra', 'roots'],
  'Polynomials': ['math', 'algebra', 'expressions'],
  'Factorization': ['math', 'algebra', 'expressions'],

  // === MATHEMATICS: Geometry (Classes 1-10) ===
  'Shapes': ['math', 'geometry', 'basic-shapes'],
  'Angles': ['math', 'geometry', 'angles'],
  'Triangles': ['math', 'geometry', 'polygons'],
  'Quadrilaterals': ['math', 'geometry', 'polygons'],
  'Circles': ['math', 'geometry', 'circles'],
  'Perimeter': ['math', 'geometry', 'measurement'],
  'Area': ['math', 'geometry', 'measurement'],
  'Volume': ['math', 'geometry', 'measurement'],
  'Pythagorean Theorem': ['math', 'geometry', 'triangles'],
  'Symmetry': ['math', 'geometry', 'transformations'],

  // === MATHEMATICS: Measurement (Classes 1-6) ===
  'Telling Time': ['math', 'measurement', 'time'],
  'Money Math': ['math', 'measurement', 'money'],
  'Length Measurement': ['math', 'measurement', 'distance'],
  'Weight Measurement': ['math', 'measurement', 'mass'],
  'Capacity Measurement': ['math', 'measurement', 'volume'],

  // === ENGLISH: Grammar - Parts of Speech (Classes 1-8) ===
  'Nouns': ['english', 'grammar', 'parts-of-speech'],
  'Pronouns': ['english', 'grammar', 'parts-of-speech'],
  'Verbs': ['english', 'grammar', 'parts-of-speech'],
  'Adjectives': ['english', 'grammar', 'parts-of-speech'],
  'Adverbs': ['english', 'grammar', 'parts-of-speech'],
  'Prepositions': ['english', 'grammar', 'parts-of-speech'],
  'Conjunctions': ['english', 'grammar', 'parts-of-speech'],
  'Interjections': ['english', 'grammar', 'parts-of-speech'],

  // === ENGLISH: Grammar - Sentence Structure (Classes 3-10) ===
  'Sentence Types': ['english', 'grammar', 'sentences'],
  'Subject and Predicate': ['english', 'grammar', 'sentences'],
  'Subject-Verb Agreement': ['english', 'grammar', 'sentences'],
  'Simple Tenses': ['english', 'grammar', 'verb-tenses'],
  'Past Tense': ['english', 'grammar', 'verb-tenses'],
  'Present Tense': ['english', 'grammar', 'verb-tenses'],
  'Future Tense': ['english', 'grammar', 'verb-tenses'],
  'Active and Passive Voice': ['english', 'grammar', 'voice'],

  // === ENGLISH: Writing & Mechanics (Classes 1-10) ===
  'Punctuation': ['english', 'writing', 'mechanics'],
  'Capitalization': ['english', 'writing', 'mechanics'],
  'Paragraph Writing': ['english', 'writing', 'composition'],
  'Essay Writing': ['english', 'writing', 'composition'],
  'Letter Writing': ['english', 'writing', 'composition'],
  'Story Writing': ['english', 'writing', 'creative-writing'],

  // === ENGLISH: Reading & Literature (Classes 1-10) ===
  'Reading Comprehension': ['english', 'reading', 'comprehension'],
  'Vocabulary': ['english', 'reading', 'vocabulary'],
  'Poetry Analysis': ['english', 'literature', 'poetry'],
  'Story Elements': ['english', 'literature', 'narrative'],
  'Character Analysis': ['english', 'literature', 'narrative'],
  'Rhyming': ['english', 'literature', 'poetry'],

  // === SCIENCE: Physics (Classes 1-10) ===
  'Simple Machines': ['science', 'physics', 'mechanics'],
  'Force and Motion': ['science', 'physics', 'mechanics'],
  'Gravity': ['science', 'physics', 'forces'],
  'Friction': ['science', 'physics', 'forces'],
  'Light and Shadows': ['science', 'physics', 'light'],
  'Reflection and Refraction': ['science', 'physics', 'light'],
  'Sound and Vibration': ['science', 'physics', 'sound'],
  'Magnets': ['science', 'physics', 'magnetism'],
  'Electricity Basics': ['science', 'physics', 'electricity'],
  'Energy Types': ['science', 'physics', 'energy'],
  'Heat and Temperature': ['science', 'physics', 'thermodynamics'],

  // === SCIENCE: Chemistry (Classes 1-10) ===
  'Matter and Materials': ['science', 'chemistry', 'matter'],
  'States of Matter': ['science', 'chemistry', 'matter'],
  'Mixtures and Solutions': ['science', 'chemistry', 'mixtures'],
  'Physical Changes': ['science', 'chemistry', 'changes'],
  'Chemical Changes': ['science', 'chemistry', 'changes'],
  'Acids and Bases': ['science', 'chemistry', 'reactions'],
  'Atoms': ['science', 'chemistry', 'atomic-structure'],
  'Periodic Table Basics': ['science', 'chemistry', 'elements'],

  // === SCIENCE: Biology (Classes 1-10) ===
  'Parts of a Plant': ['science', 'biology', 'plants'],
  'Plant Life Cycle': ['science', 'biology', 'plants'],
  'Photosynthesis': ['science', 'biology', 'plants'],
  'Animal Classification': ['science', 'biology', 'animals'],
  'Animal Habitats': ['science', 'biology', 'animals'],
  'Food Chain': ['science', 'biology', 'ecology'],
  'Food Web': ['science', 'biology', 'ecology'],
  'Ecosystems': ['science', 'biology', 'ecology'],
  'Human Body Systems': ['science', 'biology', 'human-body'],
  'Digestive System': ['science', 'biology', 'human-body'],
  'Circulatory System': ['science', 'biology', 'human-body'],
  'Respiratory System': ['science', 'biology', 'human-body'],
  'Cell Structure': ['science', 'biology', 'cells'],
  'Cell Division': ['science', 'biology', 'cells'],

  // === SCIENCE: Earth Science (Classes 1-10) ===
  'Water Cycle': ['science', 'earth-science', 'weather'],
  'Weather and Climate': ['science', 'earth-science', 'weather'],
  'Rocks and Minerals': ['science', 'earth-science', 'geology'],
  'Soil Types': ['science', 'earth-science', 'geology'],
  'Solar System': ['science', 'earth-science', 'astronomy'],
  'Planets': ['science', 'earth-science', 'astronomy'],
  'Day and Night': ['science', 'earth-science', 'astronomy'],
  'Seasons': ['science', 'earth-science', 'astronomy'],

  // === HISTORY: Ancient Civilizations (Classes 4-10) ===
  'Ancient Egypt': ['history', 'ancient-civilizations', 'world-history'],
  'Ancient Greece': ['history', 'ancient-civilizations', 'world-history'],
  'Ancient Rome': ['history', 'ancient-civilizations', 'world-history'],
  'Mesopotamia': ['history', 'ancient-civilizations', 'world-history'],
  'Indus Valley Civilization': ['history', 'ancient-civilizations', 'world-history'],

  // === HISTORY: Medieval Period (Classes 5-10) ===
  'Medieval Europe': ['history', 'medieval-period', 'world-history'],
  'Knights and Castles': ['history', 'medieval-period', 'world-history'],
  'Feudalism': ['history', 'medieval-period', 'social-systems'],
  'Viking Age': ['history', 'medieval-period', 'world-history'],

  // === HISTORY: Exploration & Discovery (Classes 6-10) ===
  'Age of Exploration': ['history', 'exploration', 'world-history'],
  'Famous Explorers': ['history', 'exploration', 'world-history'],
  'Discovery of Americas': ['history', 'exploration', 'world-history'],

  // === HISTORY: Modern History (Classes 8-10) ===
  'Industrial Revolution': ['history', 'modern-history', 'world-history'],
  'World War I': ['history', 'modern-history', 'world-history'],
  'World War II': ['history', 'modern-history', 'world-history'],
  'Independence Movements': ['history', 'modern-history', 'world-history'],

  // === GEOGRAPHY (Classes 1-10) ===
  'Maps and Globes': ['geography', 'map-skills', 'spatial-awareness'],
  'Continents and Oceans': ['geography', 'world-geography', 'physical-geography'],
  'Countries and Capitals': ['geography', 'world-geography', 'political-geography'],
  'Landforms': ['geography', 'physical-geography', 'earth-features'],
  'Rivers and Mountains': ['geography', 'physical-geography', 'earth-features'],
  'Climate Zones': ['geography', 'physical-geography', 'climate'],
  'Natural Resources': ['geography', 'physical-geography', 'resources'],
};

/**
 * Get all valid topics from taxonomy
 */
export const getAllTopics = (): string[] => {
  return Object.keys(TOPIC_TAXONOMY).sort();
};

/**
 * Get domains for a specific topic
 *
 * @param topic - Topic name (case-sensitive)
 * @returns Array of domain strings, or undefined if topic not found
 */
export const getDomainsForTopic = (topic: string): string[] | undefined => {
  return TOPIC_TAXONOMY[topic];
};

/**
 * Check if a topic exists in the taxonomy
 *
 * @param topic - Topic name to check
 * @param caseSensitive - Whether to match case-sensitively (default: false)
 * @returns True if topic exists
 */
export const isValidTopic = (topic: string, caseSensitive: boolean = false): boolean => {
  if (caseSensitive) {
    return topic in TOPIC_TAXONOMY;
  }

  const lowerTopic = topic.toLowerCase();
  return Object.keys(TOPIC_TAXONOMY).some((t) => t.toLowerCase() === lowerTopic);
};

/**
 * Find exact topic match (case-insensitive)
 *
 * @param topic - Topic name to search for
 * @returns Exact topic name from taxonomy, or undefined if not found
 */
export const findExactTopic = (topic: string): string | undefined => {
  const lowerTopic = topic.toLowerCase();
  return Object.keys(TOPIC_TAXONOMY).find((t) => t.toLowerCase() === lowerTopic);
};

/**
 * Find similar topics using simple string matching
 *
 * @param topic - Topic name to search for
 * @param limit - Maximum number of suggestions (default: 3)
 * @returns Array of similar topic names
 */
export const findSimilarTopics = (topic: string, limit: number = 3): string[] => {
  const lowerTopic = topic.toLowerCase();
  const allTopics = getAllTopics();

  // Score topics by similarity
  const scored = allTopics
    .map((t) => ({
      topic: t,
      score: calculateSimilarity(lowerTopic, t.toLowerCase()),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.topic);
};

/**
 * Simple similarity scoring (substring match + word overlap)
 */
const calculateSimilarity = (query: string, target: string): number => {
  let score = 0;

  // Exact substring match
  if (target.includes(query)) {
    score += 10;
  }

  // Word overlap
  const queryWords = query.split(/\s+/);
  const targetWords = target.split(/\s+/);
  const overlap = queryWords.filter((w) => targetWords.some((tw) => tw.includes(w) || w.includes(tw)));
  score += overlap.length * 5;

  return score;
};

/**
 * Format taxonomy for injection into LLM system prompts
 *
 * @param includeAll - Include all topics (default: false, shows sample)
 * @returns Formatted string for prompt injection
 */
export const formatTaxonomyForPrompt = (includeAll: boolean = false): string => {
  const topics = includeAll ? getAllTopics() : getAllTopics().slice(0, 20);

  const lines = topics.map((topic) => {
    const domains = TOPIC_TAXONOMY[topic];
    return `- "${topic}" → [${domains.join(', ')}]`;
  });

  const header = includeAll ? 'COMPLETE TOPIC TAXONOMY:' : 'TOPIC TAXONOMY (sample):';

  return `${header}\n${lines.join('\n')}${includeAll ? '' : '\n... and more'}`;
};

/**
 * Get all unique domains from taxonomy
 */
export const getAllDomains = (): string[] => {
  const domainsSet = new Set<string>();
  Object.values(TOPIC_TAXONOMY).forEach((domains) => {
    domains.forEach((d) => domainsSet.add(d));
  });
  return Array.from(domainsSet).sort();
};
