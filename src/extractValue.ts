import Lens from "chrome-lens-ocr";
import { createWorker } from "tesseract.js";
import path from "path";
import sharp from "sharp";

// Global flag to track Chrome Lens availability
let chromeLensBlocked = false;

export default async function extractValue() {
  const imagePath = path.join(__dirname, "image.jpg");

  console.log("🔍 Starting enhanced captcha extraction v3...");

  try {
    // Try more aggressive preprocessing strategies
    const strategies = [
      { name: "Original", preprocess: false },
      { name: "Ultra Enhanced", preprocess: true, ultraEnhance: true },
      { name: "Super Contrast", preprocess: true, superContrast: true },
      { name: "Mega Sharp", preprocess: true, megaSharp: true },
      { name: "Clean BW", preprocess: true, cleanBW: true },
      { name: "Inverted", preprocess: true, inverted: true },
      { name: "Morphological", preprocess: true, morphological: true },
      { name: "Adaptive Threshold", preprocess: true, adaptiveThreshold: true },
      { name: "Noise Reduction", preprocess: true, noiseReduction: true },
      { name: "Character Focused", preprocess: true, characterFocused: true },
      { name: "Histogram Equalized", preprocess: true, histogramEqualized: true },
      { name: "Character Segmented", preprocess: true, characterSegmented: true }
    ];

    if (chromeLensBlocked) {
      console.log("⚠️ Chrome Lens blocked, using Tesseract-only mode");
    }

    const allResults = [];
    let successfulStrategies = 0;

    for (const strategy of strategies) {
      try {
        console.log(`🔍 Trying strategy: ${strategy.name}`);

        let processedPath = imagePath;
        if (strategy.preprocess) {
          processedPath = await preprocessImageV3(imagePath, strategy);
        }

        const results = await tryMultipleOCRApproaches(processedPath, strategy.name);
        if (results.length > 0) {
          allResults.push(...results.map(r => ({ ...r, strategy: strategy.name })));
          successfulStrategies++;
        }
      } catch (error: any) {
        console.log(`❌ Strategy ${strategy.name} failed: ${error.message}`);
      }
    }

    console.log(`📊 Completed ${successfulStrategies}/${strategies.length} strategies successfully`);

    if (allResults.length > 0) {
      // Advanced ensemble processing
      const bestResult = await processEnsembleResults(allResults);

      console.log("🏆 Top results:");
      allResults.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. "${result.text}" (${result.strategy}, score: ${result.score?.toFixed(2) || 'N/A'})`);
      });

      console.log(`✅ Ensemble result: "${bestResult}"`);
      return bestResult;
    }

    console.log("❌ All strategies failed");
    return null;

  } catch (error: any) {
    console.log(`❌ OCR extraction error: ${error.message}`);
    return null;
  }
}

async function preprocessImageV3(imagePath: string, strategy: any): Promise<string> {
  const outputPath = path.join(__dirname, `processed-v3-${strategy.name.toLowerCase().replace(/ /g, '-')}.jpg`);

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

  if (strategy.morphological) {
    // Morphological operations for character separation
    sharpImage = sharpImage
      .resize(800, 320, { fit: 'fill' })
      .grayscale()
      .normalize()
      .linear(1.8, -(128 * 1.8) + 128) // Moderate contrast
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 9, -1, -1, -1, -1] // Sharpening kernel
      })
      .threshold(120); // Slightly lower threshold
  }

  if (strategy.adaptiveThreshold) {
    // Adaptive threshold approach
    sharpImage = sharpImage
      .resize(700, 280, { fit: 'fill' })
      .grayscale()
      .blur(0.5) // Slight blur first
      .sharpen(4, 2, 1)
      .normalize()
      .linear(2.5, -(128 * 2.5) + 128); // Strong contrast without fixed threshold
  }

  if (strategy.noiseReduction) {
    // Noise reduction while preserving characters
    sharpImage = sharpImage
      .resize(600, 240, { fit: 'fill' })
      .modulate({ brightness: 1.1, saturation: 0.2 })
      .blur(0.8) // More aggressive blur
      .sharpen(6, 2, 1) // Then sharpen strongly
      .normalize()
      .linear(1.6, -(128 * 1.6) + 128); // Moderate contrast
  }

  if (strategy.characterFocused) {
    // Character-focused enhancement
    sharpImage = sharpImage
      .resize(900, 360, { fit: 'fill' }) // Larger scale for better character recognition
      .grayscale()
      .normalize()
      .modulate({ brightness: 1.05 })
      .sharpen(3, 1, 0.8)
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0] // Edge enhancement
      })
      .linear(1.4, -(128 * 1.4) + 128); // Light contrast
  }

  if (strategy.histogramEqualized) {
    // Histogram equalization for better contrast distribution
    sharpImage = sharpImage
      .resize(800, 320, { fit: 'fill' })
      .grayscale()
      .normalise() // Histogram equalization equivalent
      .modulate({ brightness: 1.1 })
      .sharpen(4, 2, 1)
      .linear(1.5, -(128 * 1.5) + 128);
  }

  if (strategy.characterSegmented) {
    // Character segmentation approach with heavy processing
    sharpImage = sharpImage
      .resize(1000, 400, { fit: 'fill' }) // Very large for character detail
      .grayscale()
      .normalize()
      .convolve({
        width: 5,
        height: 5,
        kernel: [
          -1, -1, -1, -1, -1,
          -1, -1, -1, -1, -1,
          -1, -1, 25, -1, -1,
          -1, -1, -1, -1, -1,
          -1, -1, -1, -1, -1
        ] // Character isolation kernel
      })
      .modulate({ brightness: 1.05 })
      .linear(2.0, -(128 * 2.0) + 128);
  }

  await sharpImage.jpeg({ quality: 100 }).toFile(outputPath);
  return outputPath;
}

async function tryTesseractOCR(imagePath: string): Promise<Array<{text: string, confidence?: number}>> {
  const results = [];

  // Try multiple Tesseract configurations with enhanced settings
  const configs = [
    {
      name: "Single Word LSTM",
      tessedit_pageseg_mode: '8', // Single word
      tessedit_ocr_engine_mode: '1', // LSTM only
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz0123456789'
    },
    {
      name: "Single Line LSTM",
      tessedit_pageseg_mode: '7', // Single text line
      tessedit_ocr_engine_mode: '1', // LSTM only
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz0123456789'
    },
    {
      name: "Raw Line LSTM",
      tessedit_pageseg_mode: '13', // Raw line
      tessedit_ocr_engine_mode: '1', // LSTM only
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz0123456789'
    },
    {
      name: "Legacy Single Word",
      tessedit_pageseg_mode: '8', // Single word
      tessedit_ocr_engine_mode: '0', // Legacy engine
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz0123456789'
    },
    {
      name: "Block LSTM",
      tessedit_pageseg_mode: '6', // Uniform block of text
      tessedit_ocr_engine_mode: '1', // LSTM only
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz0123456789'
    }
  ];

  for (const config of configs) {
    try {
      // Create worker with OCR engine mode specified during initialization
      const worker = await createWorker('eng', config.tessedit_ocr_engine_mode, {
        logger: () => {}, // Disable verbose logging
    	langPath: path.resolve(__dirname, 'tessdata')  // if you host your own .traineddata
      });

      // Configure Tesseract for better captcha recognition (only runtime parameters)
      await worker.setParameters({
        tessedit_char_whitelist: config.tessedit_char_whitelist,
        tessedit_pageseg_mode: config.tessedit_pageseg_mode
        // tessedit_ocr_engine_mode removed - set during worker creation
      });

      const { data } = await worker.recognize(imagePath);
      await worker.terminate();

      if (data.text) {
        const cleanText = data.text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (cleanText.length >= 4 && cleanText.length <= 8) {
          results.push({
            text: cleanText,
            confidence: data.confidence / 100
          });
        }
      }

    } catch (error) {
      console.log(`Tesseract ${config.name} error:`, error);
    }
  }

  return results;
}

async function tryMultipleOCRApproaches(imagePath: string, strategyName: string): Promise<Array<{text: string, confidence?: number}>> {
  const results = [];

  // Try Tesseract first (more reliable and doesn't depend on external services)
  try {
    const tesseractResults = await tryTesseractOCR(imagePath);
    results.push(...tesseractResults);
  } catch (error) {
    console.log(`Tesseract failed for ${strategyName}:`, error);
  }

  // Try chrome-lens-ocr only if Tesseract didn't produce good results and Chrome Lens isn't blocked
  if (!chromeLensBlocked && (results.length === 0 || !results.some(r => isValidCaptchaV2(r.text)))) {
    try {
      const lensResults = await tryChromeLensOCR(imagePath, strategyName);
      results.push(...lensResults);
    } catch (error) {
      console.log(`Chrome Lens completely failed for ${strategyName}:`, error.message);
    }
  }

  // Remove duplicates and return unique results
  const uniqueResults = [];
  const seen = new Set();

  for (const result of results) {
    if (!seen.has(result.text)) {
      seen.add(result.text);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}

async function tryChromeLensOCR(imagePath: string, strategyName: string): Promise<Array<{text: string, confidence?: number}>> {
  const results = [];

  // Multiple configurations with better error handling
  const configs = [
    {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 10000 // 10 second timeout
    },
    {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
      },
      timeout: 5000 // 5 second timeout for backup
    }
  ];

  for (let i = 0; i < configs.length; i++) {
    try {
      console.log(`Trying Chrome Lens config ${i + 1}/${configs.length} for ${strategyName}...`);

      const lens = new Lens(configs[i]);

      // Add timeout to the lens operation
      const data = await Promise.race([
        lens.scanByFile(imagePath),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Chrome Lens timeout')), configs[i].timeout)
        )
      ]);

      if (data && data.segments && data.segments.length > 0) {
        // Try multiple text extraction approaches
        const candidates = [
          data.segments[0].text,
          data.segments.map(s => s.text).join(''),
          data.segments.map(s => s.text).join('').replace(/\s+/g, ''),
          data.segments.map(s => s.text.replace(/[^a-zA-Z0-9]/g, '')).join('')
        ];

        for (const candidate of candidates) {
          if (candidate) {
            // Apply multiple correction strategies
            const correctedVersions = [
              correctOCRMistakesV2(candidate, 'conservative'),
              correctOCRMistakesV2(candidate, 'aggressive'),
              correctOCRMistakesV2(candidate, 'numbers'),
              correctOCRMistakesV2(candidate, 'letters')
            ];

            for (const corrected of correctedVersions) {
              if (corrected && isValidCaptchaV2(corrected)) {
                results.push({
                  text: corrected,
                  confidence: 0.7 // Default confidence for Chrome Lens
                });
              }
            }
          }
        }

        // If we got results, break out of the config loop
        if (results.length > 0) {
          console.log(`Chrome Lens config ${i + 1} successful for ${strategyName}`);
          break;
        }
      }

    } catch (error) {
      console.log(`Chrome Lens config ${i + 1} failed for ${strategyName}:`, error.message);

      // Check for specific error types
      if (error.message.includes('403') || error.message.includes('blocked') ||
          error.message.includes('redirect') || error.message.includes('location') ||
          error.message.includes('LensError')) {
        console.log(`Chrome Lens appears to be blocked by Google, disabling for this session`);
        chromeLensBlocked = true;
        break; // Don't try other configs if we're being blocked
      }
    }
  }

  return results;
}

function correctOCRMistakesV2(text: string, mode: string): string {
  if (!text) return '';

  // Clean non-alphanumeric characters and convert to lowercase
  let cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // Apply enhanced character corrections based on mode
  if (mode === 'conservative') {
    // Conservative: only fix most common OCR mistakes
    cleaned = cleaned
      .replace(/o/g, '0')  // o -> 0
      .replace(/l/g, '1')  // l -> 1
      .replace(/i/g, '1')  // i -> 1
      .replace(/s/g, '5')  // s -> 5
      .replace(/g/g, '6')  // g -> 6
      .replace(/b/g, '8')  // b -> 8
      .replace(/z/g, '2'); // z -> 2
  } else if (mode === 'aggressive') {
    // Aggressive: fix more character confusions
    cleaned = cleaned
      .replace(/[oil]/g, '0')  // o,i,l -> 0
      .replace(/[sz]/g, '2')   // s,z -> 2
      .replace(/[gb]/g, '6')   // g,b -> 6
      .replace(/[t]/g, '7')    // t -> 7
      .replace(/[il]/g, '1')   // i,l -> 1
      .replace(/[s]/g, '5')    // s -> 5
      .replace(/[b]/g, '8');   // b -> 8
  } else if (mode === 'numbers') {
    // Numbers: prefer numeric interpretations
    cleaned = cleaned
      .replace(/[oil]/g, '0')
      .replace(/[il]/g, '1')
      .replace(/[sz]/g, '2')
      .replace(/[sz]/g, '5')
      .replace(/[gb]/g, '6')
      .replace(/[t]/g, '7')
      .replace(/[b]/g, '8');
  } else if (mode === 'letters') {
    // Letters: prefer letter interpretations
    cleaned = cleaned
      .replace(/0/g, 'o')
      .replace(/1/g, 'l')
      .replace(/2/g, 'z')
      .replace(/5/g, 's')
      .replace(/6/g, 'g')
      .replace(/7/g, 't')
      .replace(/8/g, 'b');
  }

  // Apply length-based corrections
  cleaned = correctLength(cleaned);

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


// Character similarity matrix based on visual appearance and OCR common mistakes
const CHARACTER_SIMILARITY_MATRIX: { [key: string]: Array<{char: string, similarity: number}> } = {
  '0': [{char: 'o', similarity: 0.9}, {char: 'O', similarity: 0.95}, {char: 'q', similarity: 0.7}],
  'o': [{char: '0', similarity: 0.9}, {char: 'O', similarity: 0.8}, {char: 'a', similarity: 0.6}],
  '1': [{char: 'l', similarity: 0.9}, {char: 'I', similarity: 0.95}, {char: 'i', similarity: 0.8}],
  'l': [{char: '1', similarity: 0.9}, {char: 'I', similarity: 0.85}, {char: 'i', similarity: 0.7}],
  '2': [{char: 'z', similarity: 0.8}, {char: 'Z', similarity: 0.85}, {char: '8', similarity: 0.6}],
  'z': [{char: '2', similarity: 0.8}, {char: 'Z', similarity: 0.9}, {char: 's', similarity: 0.6}],
  '3': [{char: 'e', similarity: 0.7}, {char: 'E', similarity: 0.75}, {char: 'B', similarity: 0.6}],
  '4': [{char: 'A', similarity: 0.7}, {char: 'h', similarity: 0.6}, {char: 'd', similarity: 0.8}],
  '5': [{char: 's', similarity: 0.8}, {char: 'S', similarity: 0.85}, {char: 'g', similarity: 0.6}],
  's': [{char: '5', similarity: 0.8}, {char: 'S', similarity: 0.9}, {char: 'z', similarity: 0.6}],
  '6': [{char: 'g', similarity: 0.8}, {char: 'G', similarity: 0.85}, {char: 'b', similarity: 0.7}],
  'g': [{char: '6', similarity: 0.8}, {char: 'q', similarity: 0.7}, {char: '9', similarity: 0.6}],
  '7': [{char: 'l', similarity: 0.85}, {char: 't', similarity: 0.7}, {char: 'T', similarity: 0.75}],
  't': [{char: '7', similarity: 0.7}, {char: 'l', similarity: 0.6}, {char: 'f', similarity: 0.6}],
  '8': [{char: 'b', similarity: 0.8}, {char: 'B', similarity: 0.85}, {char: 'a', similarity: 0.7}],
  'b': [{char: '8', similarity: 0.8}, {char: 'p', similarity: 0.85}, {char: '6', similarity: 0.7}],
  '9': [{char: 'g', similarity: 0.7}, {char: 'q', similarity: 0.75}, {char: 'p', similarity: 0.6}],
  'a': [{char: 'o', similarity: 0.6}, {char: '8', similarity: 0.7}, {char: 'e', similarity: 0.6}],
  'c': [{char: 'o', similarity: 0.8}, {char: 'e', similarity: 0.7}, {char: '0', similarity: 0.6}],
  'd': [{char: 'b', similarity: 0.7}, {char: 'p', similarity: 0.6}, {char: '4', similarity: 0.8}],
  'e': [{char: 'c', similarity: 0.7}, {char: 'o', similarity: 0.6}, {char: '3', similarity: 0.7}],
  'f': [{char: 't', similarity: 0.6}, {char: 'r', similarity: 0.6}, {char: 'p', similarity: 0.7}],
  'h': [{char: 'n', similarity: 0.7}, {char: 'b', similarity: 0.6}, {char: '4', similarity: 0.6}],
  'i': [{char: '1', similarity: 0.8}, {char: 'l', similarity: 0.7}, {char: 'j', similarity: 0.6}],
  'm': [{char: 'n', similarity: 0.8}, {char: 'w', similarity: 0.6}, {char: 'rn', similarity: 0.7}],
  'n': [{char: 'h', similarity: 0.7}, {char: 'm', similarity: 0.8}, {char: 'r', similarity: 0.6}],
  'p': [{char: 'b', similarity: 0.85}, {char: 'd', similarity: 0.6}, {char: 'q', similarity: 0.7}],
  'q': [{char: 'p', similarity: 0.7}, {char: 'g', similarity: 0.7}, {char: '9', similarity: 0.75}],
  'r': [{char: 'n', similarity: 0.6}, {char: 'f', similarity: 0.6}, {char: 'i', similarity: 0.5}],
  'u': [{char: 'v', similarity: 0.7}, {char: 'n', similarity: 0.6}, {char: 'w', similarity: 0.6}],
  'v': [{char: 'u', similarity: 0.7}, {char: 'w', similarity: 0.7}, {char: 'y', similarity: 0.6}],
  'w': [{char: 'v', similarity: 0.7}, {char: 'u', similarity: 0.6}, {char: 'm', similarity: 0.6}],
  'x': [{char: 'y', similarity: 0.6}, {char: 'k', similarity: 0.6}, {char: 'z', similarity: 0.5}],
  'y': [{char: 'v', similarity: 0.6}, {char: 'x', similarity: 0.6}, {char: 'u', similarity: 0.5}]
};

async function processEnsembleResults(allResults: Array<{text: string, confidence?: number, strategy: string}>): Promise<string> {
  if (allResults.length === 0) return null;

  console.log(`🎯 Processing ${allResults.length} OCR results with ensemble voting...`);

  // Step 1: Apply character similarity corrections to all results
  const correctedResults = allResults.map(result => ({
    ...result,
    originalText: result.text,
    text: applyCharacterSimilarityCorrection(result.text)
  }));

  // Step 2: Filter for valid format results
  const validResults = correctedResults.filter(result =>
    result.text && isValidCaptchaV2(result.text)
  );

  if (validResults.length === 0) {
    console.log("📊 No valid format results, trying ensemble reconstruction...");
    return await ensembleReconstruction(correctedResults);
  }

  // Step 3: Character-wise ensemble voting
  const ensembleResult = performCharacterWiseVoting(validResults);

  if (ensembleResult && isValidCaptchaV2(ensembleResult)) {
    console.log(`🎉 Ensemble voting success: "${ensembleResult}"`);
    return ensembleResult;
  }

  // Step 4: Fallback to best scoring result
  const scoredResults = validResults.map(result => ({
    ...result,
    score: scoreResultV3(result.text, result.confidence || 0.5)
  }));

  scoredResults.sort((a, b) => b.score - a.score);
  const bestResult = scoredResults[0]?.text;

  console.log(`📈 Fallback to best scored result: "${bestResult}"`);
  return bestResult || null;
}

function applyCharacterSimilarityCorrection(text: string): string {
  if (!text) return '';

  let corrected = text.toLowerCase();

  // Apply character-by-character similarity corrections
  for (let i = 0; i < corrected.length; i++) {
    const char = corrected[i];
    const similarities = CHARACTER_SIMILARITY_MATRIX[char];

    if (similarities) {
      // Find the most likely correction based on context
      const bestCorrection = findBestCorrection(char, corrected, i, similarities);
      if (bestCorrection) {
        corrected = corrected.substring(0, i) + bestCorrection + corrected.substring(i + 1);
      }
    }
  }

  return corrected;
}

function findBestCorrection(
  originalChar: string,
  fullText: string,
  position: number,
  similarities: Array<{char: string, similarity: number}>
): string | null {
  // Context-aware correction based on position and surrounding characters
  const context = {
    isFirstChar: position === 0,
    isLastChar: position === fullText.length - 1,
    prevChar: position > 0 ? fullText[position - 1] : null,
    nextChar: position < fullText.length - 1 ? fullText[position + 1] : null
  };

  for (const correction of similarities) {
    // Apply contextual rules
    if (correction.similarity > 0.8) {
      // High similarity - consider correction based on captcha patterns
      if (isReasonableInContext(correction.char, context, fullText)) {
        return correction.char;
      }
    }
  }

  return null; // Keep original character
}

function isReasonableInContext(char: string, context: any, fullText: string): boolean {
  // Basic contextual rules for captcha patterns
  const letterCount = (fullText.match(/[a-z]/g) || []).length;
  const numberCount = (fullText.match(/[0-9]/g) || []).length;

  const isLetter = /[a-z]/.test(char);
  const isNumber = /[0-9]/.test(char);

  // Prefer balanced letter/number distribution
  if (isLetter && letterCount > 4) return false; // Too many letters
  if (isNumber && numberCount > 4) return false; // Too many numbers

  // Position-based preferences (captchas often start with letters)
  if (context.isFirstChar && isNumber && Math.random() > 0.7) return false;

  return true;
}

function performCharacterWiseVoting(results: Array<{text: string, confidence?: number, strategy: string}>): string {
  if (results.length === 0) return null;

  // Ensure all results are 6 characters for voting
  const normalizedResults = results
    .filter(r => r.text && r.text.length === 6)
    .map(r => r.text);

  if (normalizedResults.length === 0) return null;

  let votedResult = '';

  // Vote on each character position
  for (let pos = 0; pos < 6; pos++) {
    const charVotes: { [key: string]: number } = {};

    normalizedResults.forEach(text => {
      const char = text[pos];
      charVotes[char] = (charVotes[char] || 0) + 1;
    });

    // Find character with most votes
    const winningChar = Object.keys(charVotes).reduce((a, b) =>
      charVotes[a] > charVotes[b] ? a : b
    );

    votedResult += winningChar;
  }

  return votedResult;
}

async function ensembleReconstruction(results: Array<{text: string, confidence?: number, strategy: string}>): Promise<string> {
  console.log("🔧 Attempting ensemble reconstruction...");

  // Collect all characters from all results
  const allChars = results
    .filter(r => r.text)
    .flatMap(r => r.text.split(''))
    .filter(c => /[a-z0-9]/.test(c));

  if (allChars.length === 0) return null;

  // Try to reconstruct a 6-character result
  const charFreq: { [key: string]: number } = {};
  allChars.forEach(char => {
    charFreq[char] = (charFreq[char] || 0) + 1;
  });

  // Take the 6 most common characters
  const topChars = Object.keys(charFreq)
    .sort((a, b) => charFreq[b] - charFreq[a])
    .slice(0, 6);

  if (topChars.length >= 4) {
    // Pad to 6 if needed
    while (topChars.length < 6) {
      const candidates = ['a', 'e', 'i', 'o', 'u', 'x', 'y', 'z', '2', '3', '4', '5', '6', '7', '8', '9'];
      const unusedChar = candidates.find(c => !topChars.includes(c));
      if (unusedChar) topChars.push(unusedChar);
      else break;
    }

    const reconstructed = topChars.slice(0, 6).join('');
    console.log(`🔧 Reconstructed: "${reconstructed}"`);
    return reconstructed;
  }

  return null;
}

function scoreResultV3(text: string, confidence: number): number {
  let score = confidence * 10; // Base score from confidence

  // Prefer exactly 6 characters (all examples are 6 chars)
  if (text.length === 6) score += 20;
  else if (text.length === 5 || text.length === 7) score += 8;
  else score -= 10;

  // Prefer mixed content
  const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
  const numberCount = (text.match(/[0-9]/g) || []).length;

  if (letterCount > 0 && numberCount > 0) score += 10;
  if (letterCount >= 2 && numberCount >= 2) score += 8;
  if (letterCount >= 3 && letterCount <= 4) score += 5;
  if (numberCount >= 2 && numberCount <= 3) score += 5;

  // Prefer lowercase (all examples are lowercase)
  if (text === text.toLowerCase()) score += 8;

  // Bonus for realistic character combinations
  if (!/(.)\1{2,}/.test(text)) score += 5; // No triple repeats
  if (!/^[0-9]+$/.test(text) && !/^[a-zA-Z]+$/.test(text)) score += 8; // Mixed

  // Penalize unlikely character sequences
  if (/[8a]{2,}/.test(text)) score -= 5; // Unlikely: "8a", "aa", etc.
  if (/[0o]{2,}/.test(text)) score -= 3; // Confusing: "0o", "oo"

  return score;
}

// Export for testing
export { correctOCRMistakesV2, processEnsembleResults };
