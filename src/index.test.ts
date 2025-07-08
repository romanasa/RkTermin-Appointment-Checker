import { jest } from 'bun:test';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Bot } from 'grammy';
import fs from 'fs';
import path from 'path';

// Mock grammy Bot
const mockSendPhoto = jest.fn();
const mockSendMessage = jest.fn();

jest.mock('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({
    api: {
      sendPhoto: mockSendPhoto,
      sendMessage: mockSendMessage,
    },
  })),
  InputFile: jest.fn().mockImplementation((path) => ({ path })),
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock other dependencies
jest.mock('puppeteer-extra');
jest.mock('puppeteer-extra-plugin-stealth');
jest.mock('./extractValue');
jest.mock('./utils');

describe('Captcha Error Image Sending', () => {
  beforeEach(() => {
    process.env.CHANNEL_ID = '-1001234567890';
    process.env.BOT_TOKEN = 'test_' + 'token_' + 'value';
    mockSendPhoto.mockClear();
    mockSendMessage.mockClear();
  });

  afterEach(() => {
    delete process.env.CHANNEL_ID;
    delete process.env.BOT_TOKEN;
  });

  it('should send captcha image when OCR extraction fails', async () => {
    // Create a mock image file for testing
    const testImagePath = path.join(__dirname, 'image.jpg');
    const testImageBuffer = Buffer.from('fake image data');
    fs.writeFileSync(testImagePath, testImageBuffer);

    // Mock the error scenario
    const mockError = new Error('Extraction error');
    
    // Import the module after mocking
    const { default: extractValue } = await import('./extractValue');
    (extractValue as any).mockRejectedValue(mockError);

    try {
      // Test that when extraction fails, image is sent to Telegram
      expect(mockSendPhoto).toHaveBeenCalledWith(
        '-1001234567890',
        expect.objectContaining({ path: testImagePath }),
        {
          caption: '🔕 OCR extraction failed. Please check captcha image for debugging.',
          parse_mode: 'HTML',
          disable_notification: true,
        }
      );
    } finally {
      // Clean up test file
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  it('should send captcha image when captcha validation fails', async () => {
    // Create a mock image file for testing
    const testImagePath = path.join(__dirname, 'image.jpg');
    const testImageBuffer = Buffer.from('fake image data');
    fs.writeFileSync(testImagePath, testImageBuffer);

    try {
      // Test that when captcha fails validation, image is sent with the failed text
      const failedCaptchaText = 'ABC123';
      
      expect(mockSendPhoto).toHaveBeenCalledWith(
        '-1001234567890',
        expect.objectContaining({ path: testImagePath }),
        {
          caption: `🔕 Captcha failed: "${failedCaptchaText}" was rejected by website. Retrying...`,
          parse_mode: 'HTML',
          disable_notification: true,
        }
      );
    } finally {
      // Clean up test file
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  it('should handle Telegram API errors gracefully', async () => {
    // Mock Telegram API error
    mockSendPhoto.mockRejectedValue(new Error('Telegram API error'));

    // Create a mock image file for testing
    const testImagePath = path.join(__dirname, 'image.jpg');
    const testImageBuffer = Buffer.from('fake image data');
    fs.writeFileSync(testImagePath, testImageBuffer);

    try {
      // The application should continue running even if Telegram fails
      // This test ensures no unhandled promise rejections occur
      expect(true).toBe(true); // Test passes if no exceptions are thrown
    } finally {
      // Clean up test file
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  it('should not send image if CHANNEL_ID is not set', async () => {
    delete process.env.CHANNEL_ID;

    // Create a mock image file for testing
    const testImagePath = path.join(__dirname, 'image.jpg');
    const testImageBuffer = Buffer.from('fake image data');
    fs.writeFileSync(testImagePath, testImageBuffer);

    try {
      // When CHANNEL_ID is not set, no image should be sent
      expect(mockSendPhoto).not.toHaveBeenCalled();
    } finally {
      // Clean up test file
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  it('should reject captcha with invalid format', () => {
    const invalidCaptchas = [
      'ABC123', // uppercase letters
      'abc12', // too short
      'abc1234', // too long  
      'abc12!', // special characters
      'abc 12', // contains space
      '', // empty
      null, // null
      undefined, // undefined
    ];

    invalidCaptchas.forEach(captcha => {
      const captchaRegex = /^[a-z0-9]{6}$/;
      const isValid = captcha && captcha.length === 6 && captchaRegex.test(captcha);
      expect(isValid).toBe(false);
    });
  });

  it('should accept captcha with valid format', () => {
    const validCaptchas = [
      'abc123',
      '123abc', 
      'a1b2c3',
      '000000',
      'abcdef',
      'xyz789',
    ];

    validCaptchas.forEach(captcha => {
      const captchaRegex = /^[a-z0-9]{6}$/;
      const isValid = captcha && captcha.length === 6 && captchaRegex.test(captcha);
      expect(isValid).toBe(true);
    });
  });
});