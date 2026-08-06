// Local Chalkboard Engine: Math Solver & Premade Jokes (No external AI/Gemini needed)

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "Why was the math book sad? Because it had too many problems!",
  "There are 10 types of people in the world: those who understand binary, and those who don't.",
  "Why did the computer go to the doctor? Because it had a virus!",
  "Why couldn't the bicycle stand up by itself? It was two tired!",
  "Why did the developer go broke? Because he used up all his cache!",
  "What is a gamer's favorite type of tea? Penalty!",
  "Why don't scientists trust atoms? Because they make up everything!",
  "How do you organize a space party? You planet!",
  "What do you call a fake noodle? An impasta!",
  "Why did the golfer bring two pairs of pants? In case he got a hole in one!",
  "What do you call 8 hobbits? A hobbyte!",
  "Why was 6 afraid of 7? Because 7 ate 9!",
  "Why did the function go to the party? Because it had a great return value!",
  "What is a mathematician's favorite plant? A square root!",
  "Why did the arcade machine get a promotion? It had high scores in performance!",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem!",
  "Why did the spider get a job on the web? To build better networks!",
  "What do you call a computer that sings? A Dell!",
  "Why did the student eat his math homework? Because his teacher said it was a piece of cake!",
  "What's the best time to visit the dentist? Tooth-hurty!",
  "Why do ghosts love elevator music? Because it raises their spirits!",
  "What goes up and down but never moves? Stairs!",
  "What kind of room has no doors or windows? A mushroom!",
  "Why did the cookie go to the hospital? Because it felt crummy!",
];

let lastJokeIndex = -1;

export function getRandomJoke(): string {
  let index = Math.floor(Math.random() * JOKES.length);
  if (index === lastJokeIndex && JOKES.length > 1) {
    index = (index + 1) % JOKES.length;
  }
  lastJokeIndex = index;
  return JOKES[index];
}

export function isJokeRequest(input: string): boolean {
  const norm = input.toLowerCase().trim();
  return (
    norm.includes('joke') ||
    norm.includes('funny') ||
    norm.includes('make me laugh') ||
    norm.includes('crack me up') ||
    norm.includes('tell a story') ||
    norm.includes('humor')
  );
}

/**
 * Safely evaluates math expressions from voice or text input
 */
export function evaluateMath(input: string): string | null {
  const norm = input.toLowerCase().trim();

  // Percentage calculations like "15% of 200" or "what is 20 percent of 150"
  const percentMatch = norm.match(/(?:what\s+is\s+)?(\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s*(\d+(?:\.\d+)?)/i);
  if (percentMatch) {
    const pct = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const ans = (pct / 100) * total;
    return `${pct}% of ${total} = ${Number.isInteger(ans) ? ans : ans.toFixed(4)}`;
  }

  // Square root calculations like "sqrt 144" or "square root of 144"
  const sqrtMatch = norm.match(/(?:sqrt|square\s+root)(?:\s+of)?\s*(\d+(?:\.\d+)?)/i);
  if (sqrtMatch) {
    const val = parseFloat(sqrtMatch[1]);
    const ans = Math.sqrt(val);
    return `√${val} = ${Number.isInteger(ans) ? ans : ans.toFixed(4)}`;
  }

  // Sanitize math string: replace words with operators
  let expr = norm
    .replace(/what\s+is/gi, '')
    .replace(/calculate/gi, '')
    .replace(/solve/gi, '')
    .replace(/evaluate/gi, '')
    .replace(/how\s+much\s+is/gi, '')
    .replace(/equals/gi, '')
    .replace(/equal/gi, '')
    .replace(/\?/g, '')
    .replace(/plus/gi, '+')
    .replace(/minus/gi, '-')
    .replace(/times/gi, '*')
    .replace(/multiplied\s+by/gi, '*')
    .replace(/divided\s+by/gi, '/')
    .replace(/over/gi, '/')
    .replace(/to\s+the\s+power\s+of/gi, '^')
    .replace(/power\s+of/gi, '^')
    .replace(/x/gi, (m, offset, str) => {
      // replace 'x' with '*' if surrounded by digits/spaces
      const before = str.slice(0, offset).trim();
      const after = str.slice(offset + 1).trim();
      if (/[\d\)]$/.test(before) && /^[\d\(]/.test(after)) {
        return '*';
      }
      return m;
    })
    .trim();

  // Handle exponentiation ^
  expr = expr.replace(/\^/g, '**');

  // Check if string contains arithmetic chars only: digits, operators (+ - * / % . ( ) **), spaces
  const cleanExpr = expr.replace(/\s+/g, '');
  if (!/^[\d.+\-*/()%]+$/.test(cleanExpr)) {
    return null;
  }

  // Ensure there's at least one digit and one operator or calculation intent
  if (!/\d/.test(cleanExpr)) {
    return null;
  }

  try {
    // Safe evaluation using Function with strict mode
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${cleanExpr})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      const formatted = Number.isInteger(result) ? result.toString() : result.toFixed(4).replace(/\.?0+$/, '');
      const displayExpr = cleanExpr.replace(/\*\*/g, '^');
      return `${displayExpr} = ${formatted}`;
    }
  } catch (e) {
    return null;
  }

  return null;
}

export function processBoardQuery(input: string): string {
  // 1. Check if joke request
  if (isJokeRequest(input)) {
    return getRandomJoke();
  }

  // 2. Check if math expression
  const mathResult = evaluateMath(input);
  if (mathResult) {
    return mathResult;
  }

  // 3. Fallback local chalkboard message
  return `Kreational Chalkboard is in offline mode. Ask any math problem (e.g. "144 / 12" or "15% of 200") or say "tell me a joke"!`;
}
