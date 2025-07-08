import Lens from "chrome-lens-ocr";
import path from "path";
import sharp from "sharp";

export default async function extractValue() {
  const imagePath = path.join(__dirname, "image.jpg");
  
  console.log("🔍 Starting enhanced captcha extraction v2...");
  
  try {
    // Try more aggressive preprocessing strategies
    const strategies = [
      { name: "Original", preprocess: false },
      { name: "Ultra Enhanced", preprocess: true, ultraEnhance: true },
      { name: "Super Contrast", preprocess: true, superContrast: true },
      { name: "Mega Sharp", preprocess: true, megaSharp: true },
      { name: "Clean BW", preprocess: true, cleanBW: true },
      { name: "Inverted", preprocess: true, inverted: true }
    ];
    
    const allResults = [];
    
    for (const strategy of strategies) {
      console.log(`🔍 Trying strategy: ${strategy.name}`);
      
      let processedPath = imagePath;
      if (strategy.preprocess) {
        processedPath = await preprocessImageV2(imagePath, strategy);
      }
      
      const results = await tryMultipleOCRApproaches(processedPath, strategy.name);
      if (results.length > 0) {
        allResults.push(...results.map(r => ({ ...r, strategy: strategy.name })));
      }
    }
    
    if (allResults.length > 0) {
      // Score and rank all results
      const scoredResults = allResults.map(result => ({
        ...result,
        score: scoreResultV2(result.text, result.confidence || 0.5)
      }));
      
      scoredResults.sort((a, b) => b.score - a.score);
      
      console.log("🏆 Top results:");
      scoredResults.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. "${result.text}" (${result.strategy}, score: ${result.score.toFixed(2)})`);
      });
      
      const bestResult = scoredResults[0];
      console.log(`✅ Best result: "${bestResult.text}"`);
      return bestResult.text;
    }
    
    console.log("❌ All strategies failed");
    return null;
    
  } catch (error: any) {
    console.log(`❌ OCR extraction error: ${error.message}`);
    return null;
  }
}

async function preprocessImageV2(imagePath: string, strategy: any): Promise<string> {
  const outputPath = path.join(__dirname, `processed-v2-${strategy.name.toLowerCase().replace(' ', '-')}.jpg`);
  
  let sharpImage = sharp(imagePath);
  
  if (strategy.ultraEnhance) {
    // Ultra enhancement for difficult characters
    sharpImage = sharpImage
      .resize(600, 240, { fit: 'fill' }) // Even larger
      .modulate({ brightness: 1.2, saturation: 0.3 }) // Lower saturation
      .sharpen(5, 2, 1) // Aggressive sharpening
      .normalize()
      .linear(1.3, -(128 * 1.3) + 128); // Increase contrast
  }
  
  if (strategy.superContrast) {
    // Extreme contrast for character separation
    sharpImage = sharpImage
      .resize(800, 320, { fit: 'fill' })
      .grayscale()
      .linear(3.0, -(128 * 3.0) + 128) // Extreme contrast
      .sharpen(4, 2, 1)
      .threshold(128); // Binary threshold
  }
  
  if (strategy.megaSharp) {
    // Focus on sharpness and edge detection
    sharpImage = sharpImage
      .resize(700, 280, { fit: 'fill' })
      .sharpen(8, 3, 1) // Maximum sharpening
      .modulate({ brightness: 1.1, saturation: 0.4 })
      .normalize();
  }
  
  if (strategy.cleanBW) {
    // Clean black and white
    sharpImage = sharpImage
      .resize(500, 200, { fit: 'fill' })
      .grayscale()
      .normalize()
      .linear(2.0, -(128 * 2.0) + 128)
      .blur(0.3) // Slight blur to clean noise
      .sharpen(6, 2, 1); // Then sharpen
  }
  
  if (strategy.inverted) {
    // Inverted colors sometimes work better
    sharpImage = sharpImage
      .resize(600, 240, { fit: 'fill' })
      .negate() // Invert
      .modulate({ brightness: 1.1 })
      .sharpen(3, 1, 0.5)
      .normalize();
  }
  
  await sharpImage.jpeg({ quality: 100 }).toFile(outputPath);
  return outputPath;
}

// Global rate limiting for Google Lens
let lastLensCall = 0;
const LENS_COOLDOWN = 5000; // 5 second cooldown between calls

async function tryMultipleOCRApproaches(imagePath: string, strategyName: string): Promise<Array<{text: string, confidence?: number}>> {
  const results: Array<{text: string, confidence?: number}> = [];
  
  // Rate limiting - wait if not enough time has passed
  const now = Date.now();
  const timeSinceLastCall = now - lastLensCall;
  if (timeSinceLastCall < LENS_COOLDOWN) {
    const waitTime = LENS_COOLDOWN - timeSinceLastCall;
    console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before calling Google Lens for ${strategyName}`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Use only one configuration to minimize API calls
  const config = {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  };
  
  try {
    lastLensCall = Date.now(); // Update with current time after waiting
    console.log(`🔍 Calling Google Lens for ${strategyName}...`);
    
    const lens = new Lens(config);
    const data = await lens.scanByFile(imagePath);
    
    if (data.segments && data.segments.length > 0) {
      // Try multiple text extraction approaches
      const candidates = [
        data.segments[0].text,
        data.segments.map(s => s.text).join(''),
        data.segments.map(s => s.text).join('').replace(/\s+/g, ''),
        data.segments.map(s => s.text.replace(/[^a-zA-Z0-9]/g, '')).join('')
      ];
      
      for (const candidate of candidates) {
        if (candidate) {
          const corrected = correctOCRMistakesV2(candidate, 'conservative');
          if (corrected && isValidCaptchaV2(corrected)) {
            results.push({ 
              text: corrected, 
              confidence: calculateConfidence(candidate, corrected)
            });
          }
        }
      }
    }
    
  } catch (error: any) {
    console.log(`❌ Google Lens failed for ${strategyName}:`, error.message);
  }
  
  // Remove duplicates and return unique results
  const uniqueResults: Array<{text: string, confidence?: number}> = [];
  const seen = new Set<string>();
  
  for (const result of results) {
    if (!seen.has(result.text)) {
      seen.add(result.text);
      uniqueResults.push(result);
    }
  }
  
  return uniqueResults;
}

function correctOCRMistakesV2(text: string, mode: string): string {
  if (!text) return '';
  
  // Only clean non-alphanumeric characters and convert to lowercase
  // Let OCR results speak for themselves without forced corrections
  let cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  return cleaned;
}


function isValidCaptchaV2(text: string): boolean {
  if (!text) return false;
  
  // Must be alphanumeric only
  if (!/^[a-zA-Z0-9]+$/.test(text)) return false;
  
  // Expected length (based on examples: cgad8y=6, c62dg2=6, o7ccyd=6, vw3n38=6, xdcxmx=6)
  if (text.length < 4 || text.length > 8) return false;
  
  // All examples are 6 characters, prefer this length
  if (text.length === 6) return true;
  
  // Allow other lengths but with mixed content requirement
  const hasLetter = /[a-zA-Z]/.test(text);
  const hasNumber = /[0-9]/.test(text);
  
  return hasLetter || hasNumber; // Be more permissive
}

function calculateConfidence(original: string, corrected: string): number {
  if (original === corrected) return 0.9; // High confidence for no changes
  
  const changeRatio = Math.abs(original.length - corrected.length) / Math.max(original.length, corrected.length);
  return Math.max(0.1, 0.7 - changeRatio);
}

function scoreResultV2(text: string, confidence: number): number {
  let score = confidence * 10; // Base score from confidence
  
  // Prefer 6 characters (all examples are 6 chars)
  if (text.length === 6) score += 15;
  else if (text.length === 5 || text.length === 7) score += 8;
  else score -= 5;
  
  // Prefer mixed content
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  const numberCount = (text.match(/[0-9]/g) || []).length;
  
  if (letterCount > 0 && numberCount > 0) score += 8;
  if (letterCount >= 2 && numberCount >= 2) score += 5;
  
  // Prefer lowercase (all examples are lowercase)
  if (text === text.toLowerCase()) score += 5;
  
  // Bonus for realistic character combinations
  if (!/(.)\1{2,}/.test(text)) score += 3; // No triple repeats
  if (!/^[0-9]+$/.test(text) && !/^[a-zA-Z]+$/.test(text)) score += 5; // Mixed
  
  return score;
}

// Export for testing
export { correctOCRMistakesV2, preprocessImageV2, tryMultipleOCRApproaches };
