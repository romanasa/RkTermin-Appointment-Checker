import { execSync } from 'child_process';
import path from 'path';

export default async function extractValue(): Promise<string> {
  const imagePath = path.join(__dirname, "image.jpg");
  const pythonScriptPath = path.join(__dirname, "../solve.py");
  
  console.log("🐍 Using Python CAPTCHA solver...");
  
  try {
    // Call the Python script directly (assuming dependencies are installed globally or in a venv)
    const command = `python3 "${pythonScriptPath}" "${imagePath}"`;
    const output = execSync(command, { 
      encoding: 'utf8'
    });
    
    // Parse the output - format is "image.jpg → result"
    const lines = output.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const match = lastLine.match(/→\s*(.+)$/);
    
    if (match && match[1]) {
      const result = match[1].trim();
      
      // Check for error messages
      if (result.startsWith('Error:')) {
        console.error(`❌ Python solver error: ${result}`);
        return "";
      }
      
      console.log(`✅ Python solver result: "${result}"`);
      return result;
    }
    
    console.error("❌ Failed to parse Python solver output");
    return "";
    
  } catch (error: any) {
    console.error(`❌ Error calling Python solver: ${error.message}`);
    return "";
  }
}