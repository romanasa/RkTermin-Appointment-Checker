import fs from "fs";
import path from "path";
import extractValue from "./extractValue";

interface TestResult {
  imageFile: string;
  originalText: string;
  extractedText: string;
  reason: string;
  timestamp: string;
  success: boolean;
  validFormat: boolean;
}

async function testCaptchaAccuracy() {
  const srcDir = __dirname;
  const files = fs.readdirSync(srcDir);
  
  // Find all captcha image files (image1.jpg, image2.jpg, etc.)
  const imageFiles = files
    .filter(file => /^image\d+\.jpg$/.test(file))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });

  console.log(`Found ${imageFiles.length} failed captcha images to test`);
  
  if (imageFiles.length === 0) {
    console.log("No failed captcha images found. Run the application to collect some failed captchas first.");
    return;
  }

  const results: TestResult[] = [];
  const captchaRegex = /^[a-z0-9]{6}$/;
  const standardPath = path.join(srcDir, "image.jpg");

  for (const imageFile of imageFiles) {
    const metaFile = imageFile.replace('.jpg', '.meta.txt');
    const metaPath = path.join(srcDir, metaFile);
    
    let originalText = "unknown";
    let reason = "unknown";
    let timestamp = "unknown";
    
    // Read metadata if available
    if (fs.existsSync(metaPath)) {
      const metadata = fs.readFileSync(metaPath, 'utf-8');
      const extractedMatch = metadata.match(/Extracted Text: (.+)/);
      const reasonMatch = metadata.match(/Reason: (.+)/);
      const timestampMatch = metadata.match(/Timestamp: (.+)/);
      
      if (extractedMatch) originalText = extractedMatch[1];
      if (reasonMatch) reason = reasonMatch[1];
      if (timestampMatch) timestamp = timestampMatch[1];
    }

    console.log(`\nTesting ${imageFile}...`);
    console.log(`Original extraction: "${originalText}"`);
    console.log(`Failure reason: ${reason}`);

    // Copy the image to the standard location for OCR processing
    const imagePath = path.join(srcDir, imageFile);
    fs.copyFileSync(imagePath, standardPath);

    // Run OCR extraction
    let extractedText = "";
    try {
      const result = await extractValue();
      extractedText = result || "";
      console.log(`New extraction: "${extractedText}"`);
    } catch (error) {
      console.log(`New extraction failed: ${error}`);
      extractedText = "";
    }

    // Check if the new extraction has valid format
    const validFormat = Boolean(extractedText && 
                       extractedText.length === 6 && 
                       captchaRegex.test(extractedText));

    // Determine if this is a success (we can't know the actual captcha text, 
    // but we can check if the format is now valid)
    const success = Boolean(validFormat && extractedText !== originalText);

    results.push({
      imageFile,
      originalText,
      extractedText,
      reason,
      timestamp,
      success,
      validFormat
    });

    console.log(`Valid format: ${validFormat ? 'YES' : 'NO'}`);
    console.log(`Improved: ${success ? 'YES' : 'NO'}`);
  }

  // Calculate statistics
  const totalTests = results.length;
  const validFormatCount = results.filter(r => r.validFormat).length;
  const improvedCount = results.filter(r => r.success).length;
  const formatAccuracy = (validFormatCount / totalTests * 100).toFixed(1);
  const improvementRate = (improvedCount / totalTests * 100).toFixed(1);

  console.log(`\n=== CAPTCHA ACCURACY TEST RESULTS ===`);
  console.log(`Total failed captchas tested: ${totalTests}`);
  console.log(`Valid format after reprocessing: ${validFormatCount}/${totalTests} (${formatAccuracy}%)`);
  console.log(`Improved extractions: ${improvedCount}/${totalTests} (${improvementRate}%)`);

  // Show breakdown by failure reason
  const reasonCounts: Record<string, number> = {};
  const reasonValid: Record<string, number> = {};
  
  results.forEach(result => {
    reasonCounts[result.reason] = (reasonCounts[result.reason] || 0) + 1;
    if (result.validFormat) {
      reasonValid[result.reason] = (reasonValid[result.reason] || 0) + 1;
    }
  });

  console.log(`\n=== BREAKDOWN BY FAILURE REASON ===`);
  Object.keys(reasonCounts).forEach(reason => {
    const total = reasonCounts[reason];
    const valid = reasonValid[reason] || 0;
    const rate = (valid / total * 100).toFixed(1);
    console.log(`${reason}: ${valid}/${total} (${rate}%) now valid`);
  });

  // Save detailed results
  const resultsFile = path.join(srcDir, 'captcha-accuracy-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${resultsFile}`);

  // Clean up
  if (fs.existsSync(standardPath)) {
    fs.unlinkSync(standardPath);
  }

  return {
    totalTests,
    validFormatCount,
    improvedCount,
    formatAccuracy: parseFloat(formatAccuracy),
    improvementRate: parseFloat(improvementRate),
    results
  };
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCaptchaAccuracy().catch(console.error);
}

export default testCaptchaAccuracy;