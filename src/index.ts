import dotenv from "dotenv";
dotenv.config();

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import extractValue from "./extractValuePython";
import fs from "fs";
import path from "path";
import { Browser } from "puppeteer";
import { botToken, delay } from "./utils";
import { Bot, InputFile } from "grammy";
import cron from "node-cron";

let failedCaptchaCounter = 1;

if (!botToken) {
  console.error('BOT_TOKEN environment variable is required');
  process.exit(1);
}

const bot = new Bot(botToken);

puppeteer.use(StealthPlugin());
let browser: Browser | null = null;
let isRunning = false;

async function runPuppeteer() {
  try {
    console.log("Started task");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
    );
    await page.setDefaultTimeout(2000);
    await page.setDefaultNavigationTimeout(0);

    console.log("Going to the page");
    const appointmentUrl = process.env.APPOINTMENT_URL;
    if (!appointmentUrl) {
      throw new Error('APPOINTMENT_URL environment variable is required');
    }
    
    await page.goto(
      appointmentUrl,
      { waitUntil: "networkidle2" }
    );

    console.log("Waiting for captcha");
    const base64Captcha = await page.$eval(
      "captcha>div",
      (div) => div.style.background
    );
    saveBase64ToFile(base64Captcha);

    const extractedText = await extractValue();
    
    // Validate captcha: must be exactly 6 characters, lowercase letters and digits only
    const captchaRegex = /^[a-z0-9]{6}$/;
    if (
      !extractedText ||
      extractedText.length !== 6 ||
      !captchaRegex.test(extractedText)
    ) {
      console.log(`Invalid captcha format: "${extractedText}" (expected 6 lowercase letters/digits)`);
      saveFailedCaptcha(base64Captcha, extractedText || "null", "Invalid format - OCR extraction failed");
      throw new Error("Extraction error");
    }

    console.log("Typing captcha");
    await page.focus("#appointment_captcha_month_captchaText");
    await page.keyboard.type(extractedText);
    await delay(4000);

    console.log("Clicking submit");
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        page.click("#appointment_captcha_month_appointment_showMonth"),
      ]);
    } catch (error: any) {
      console.error("Error during navigation:", error.message);
      if (error.message.includes("detached")) {
        console.log("Frame was detached, retrying...");
        await page.reload();
        return;
      } else {
        throw error;
      }
    }

    console.log("Checking for captcha error");
    const captchaError = await page.evaluate(() => {
      const errorContainer = document.querySelector(".global-error");
      return errorContainer ? true : false;
    });

    if (captchaError) {
      console.log(`❌ Captcha failed: "${extractedText}" was rejected by website`);
      
      saveFailedCaptcha(base64Captcha, extractedText, "Captcha rejected by website");
      
      // Send silent notification about captcha failure with image
      try {
        const channelId = process.env.CHANNEL_ID;
        if (channelId) {
          await bot.api.sendPhoto(
            channelId,
            new InputFile(path.join(__dirname, "image.jpg")),
            { 
              caption: `🔕 Captcha failed: "${extractedText}" was rejected by website. Retrying...`,
              parse_mode: "HTML", 
              disable_notification: true 
            }
          );
        }
      } catch (telegramError) {
        console.error("Failed to send captcha failure notification to Telegram:", telegramError);
      }
      
      throw new Error("Captcha error");
    }

    console.log(`✅ Captcha accepted: "${extractedText}" was correct!`);
    console.log("Checking for availability");
    const found = await page.evaluate(() => {
      return document.body.textContent?.includes(
        "Unfortunately, there are no appointments available at this time."
      ) || false;
    });

    if (found) {
      console.log("Not available");
      const channelId = process.env.CHANNEL_ID;
      if (!channelId) {
        throw new Error('CHANNEL_ID environment variable is required');
      }
      
      await bot.api.sendPhoto(
        channelId,
        new InputFile(path.join(__dirname, "image.jpg")),
        { disable_notification: true }
      );
      await bot.api.sendMessage(
        channelId,
        `No appointment at this time. \nCaptcha was <b>${extractedText}</b>`,
        { parse_mode: "HTML", disable_notification: true }
      );
    } else {
      console.log("Appointment available");
      const channelId = process.env.CHANNEL_ID;
      if (!channelId) {
        throw new Error('CHANNEL_ID environment variable is required');
      }
      
      for (let index = 0; index < 25; index++) {
        await bot.api.sendMessage(
          channelId,
          "<b>Appointment available be quickkkkkkkkkkkkkkkkkkkkkkkkkkkkkk</b>",
          { parse_mode: "HTML" }
        );
      }
      await bot.api.sendMessage(
        channelId,
        "<b>Appointment available be quickkkkkkkkkkkkkkkkkkkkkkkkkkkkkk</b>",
        { parse_mode: "HTML" }
      );
    }

    await browser.close();
    console.log("✅ Check completed successfully. Waiting for next scheduled run...");

  } catch (error: any) {
    if (browser) {
      await browser.close();
      browser = null;
    }

    if (
      error.message !== "Extraction error" &&
      error.message !== "Captcha error" &&
      error.message !== "detached"
    ) {
      const channelId = process.env.CHANNEL_ID;
      if (channelId) {
        await bot.api.sendMessage(channelId, `Unexpected error: ${error.message}`);
      }
    } else if (error.message === "Extraction error") {
      console.log("Extraction error occurred, sending captcha image for debugging...");
      
      // Send captcha image when OCR extraction fails
      try {
        const channelId = process.env.CHANNEL_ID;
        if (channelId) {
          await bot.api.sendPhoto(
            channelId,
            new InputFile(path.join(__dirname, "image.jpg")),
            { 
              caption: `🔕 OCR extraction failed. Please check captcha image for debugging.`,
              parse_mode: "HTML", 
              disable_notification: true 
            }
          );
        }
      } catch (telegramError) {
        console.error("Failed to send extraction error image to Telegram:", telegramError);
      }
      
      setTimeout(runPuppeteer, 5000);
    } else {
      console.log("Known error occurred, retrying...");
      setTimeout(runPuppeteer, 5000);
    }

    console.error("Error occurred:", error.message);
  }
}

function saveBase64ToFile(base64String: string, filename: string = "image.jpg") {
  const base64Data = extractBase64FromBackground(base64String);
  if (!base64Data) {
    return;
  }

  const buffer = Buffer.from(base64Data, "base64");

  fs.writeFile(path.join(__dirname, filename), buffer, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log(`File saved successfully: ${filename}`);
    }
  });
}

function saveFailedCaptcha(base64String: string, extractedText: string, reason: string) {
  const filename = `image${failedCaptchaCounter}.jpg`;
  const metaFilename = `image${failedCaptchaCounter}.meta.txt`;
  
  saveBase64ToFile(base64String, filename);
  
  const metadata = `
Extracted Text: ${extractedText || 'null'}
Reason: ${reason}
Timestamp: ${new Date().toISOString()}
Counter: ${failedCaptchaCounter}
`;
  
  fs.writeFile(path.join(__dirname, metaFilename), metadata.trim(), (err) => {
    if (err) {
      console.error("Error writing metadata file:", err);
    } else {
      console.log(`Metadata saved: ${metaFilename}`);
    }
  });
  
  failedCaptchaCounter++;
}

function extractBase64FromBackground(style: string) {
  const regex = /url\(['"]data:image\/[a-zA-Z]+;base64,([a-zA-Z0-9+/=]+)['"]\)/;
  const match = style.match(regex);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

async function runWithTimeout(timeout: number) {
  let timeoutId: NodeJS.Timeout;
  
  return Promise.race([
    runPuppeteer(),
    new Promise<void>((_, reject) => {
      timeoutId = setTimeout(async () => {
        console.log("⏰ Task timed out after", timeout/1000, "seconds");
        
        // Force close browser if it's still open
        if (browser) {
          console.log("🔴 Force closing browser due to timeout");
          try {
            await browser.close();
          } catch (err) {
            console.error("Error closing browser:", err);
          }
          browser = null;
        }
        
        reject(new Error("Process timed out"));
      }, timeout);
    }),
  ]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

console.log("Started app");
cron.schedule("*/5 * * * *", async () => {
  if (isRunning) {
    console.log("⚠️ Previous task still running, skipping this execution to prevent overlap");
    return;
  }
  
  isRunning = true;
  
  try {
    console.log("Started job");
    await runWithTimeout(290000);
  } catch (error: any) {
    console.error(error.message);
    console.log("End of 5 minutes timer");
    if (browser) {
      console.log("Browser closed");
      await browser.close();
      browser = null;
    }
    console.log("Restarting after timeout...");
  } finally {
    isRunning = false;
  }
});
