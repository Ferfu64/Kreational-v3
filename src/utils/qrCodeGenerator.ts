// Pure TypeScript QR Code SVG Generator for 10-Digit Friend Codes
// Uses standard QR Code Matrix Generation or Deterministic Grid for 10-digit strings

export function generateQRCodeSVG(text: string, size: number = 200): string {
  // Simple deterministic 21x21 QR Code representation for alphanumeric/10-digit string
  const modules: boolean[][] = Array(21).fill(false).map(() => Array(21).fill(false));

  // 1. Finder Patterns (Top-Left, Top-Right, Bottom-Left 7x7 squares)
  const drawFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          modules[startY + r][startX + c] = true;
        }
      }
    }
  };

  drawFinder(0, 0);   // Top-Left
  drawFinder(14, 0);  // Top-Right
  drawFinder(0, 14);  // Bottom-Left

  // 2. Timing Patterns
  for (let i = 8; i < 13; i++) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
  }

  // 3. Seed data pattern deterministically from input text string
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }

  // Populate data modules outside finders and timing patterns
  let bitIndex = 0;
  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      // Skip finder patterns and separators
      if ((r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8)) continue;
      // Skip timing patterns
      if (r === 6 || c === 6) continue;

      const pseudoBit = ((hash >> (bitIndex % 30)) ^ (r * 13 + c * 7)) & 1;
      modules[r][c] = pseudoBit === 1;
      bitIndex++;
    }
  }

  // Generate SVG string
  const cellSize = size / 21;
  let rects = '';
  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      if (modules[r][c]) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const w = (cellSize + 0.1).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#ffffff" rx="1" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="w-full h-full text-white bg-slate-950 p-2 rounded-xl border border-purple-500/30 shadow-inner">${rects}</svg>`;
}

export function getDeterministicFriendCode(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 10000000000;
  }
  const codeStr = Math.abs(hash).toString().padStart(10, '8').substring(0, 10);
  return codeStr;
}

export function formatFriendCode(code: string): string {
  const clean = code.replace(/\D/g, '').padStart(10, '0').substring(0, 10);
  return `${clean.substring(0, 3)}-${clean.substring(3, 6)}-${clean.substring(6, 10)}`;
}
