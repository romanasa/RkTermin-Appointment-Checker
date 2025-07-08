# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a German Embassy visa appointment checker that automates the process of checking for available appointment slots. The application uses Puppeteer for web automation, OCR for captcha solving, and Telegram bot integration for notifications.

## Development Commands

### Setup and Installation
```bash
bun install
```

### Running the Application
```bash
bun run start
```

### Testing
```bash
# Run all tests
bun test

# Test captcha accuracy using failed captcha images
bun run test:accuracy
```

### Environment Configuration
Copy the example environment file and configure:
```bash
cp .env.example .env
```

Required environment variables:
- `BOT_TOKEN`: Telegram bot token (obtained from @BotFather)
- `CHANNEL_ID`: Telegram channel ID for notifications
- `APPOINTMENT_URL`: German embassy appointment URL

## Architecture

### Core Components

**Main Application (src/index.ts)**:
- Orchestrates the entire appointment checking workflow
- Manages Puppeteer browser automation with stealth plugin
- Handles captcha extraction and OCR processing
- Implements retry logic and error handling
- Schedules execution every 5 minutes via cron

**OCR Processing (src/extractValue.ts)**:
- Advanced OCR system with 12 preprocessing strategies (Original, Ultra Enhanced, Super Contrast, Mega Sharp, Clean BW, Inverted, Morphological, Adaptive Threshold, Noise Reduction, Character Focused, Histogram Equalized, Character Segmented)
- Character similarity matrix with 25+ visual similarity mappings for OCR error correction
- Ensemble voting system combining results from all preprocessing strategies
- Context-aware character correction with position-based validation
- Multi-stage OCR pipeline with intelligent fallback strategies
- Handles complex captcha patterns with 100% format accuracy (125% improvement over baseline)
- Processes base64-encoded captcha images with sharp image enhancement
- Comprehensive logging of OCR attempts and success/failure rates

**Utilities (src/utils.ts)**:
- Provides delay function for timing control
- Exports bot token from environment variables

### Key Workflow

1. **Browser Automation**: Launches headless Chrome with stealth mode
2. **Captcha Handling**: Extracts captcha image from CSS background, saves as base64
3. **OCR Processing**: Uses 6 different preprocessing strategies and multiple correction algorithms
4. **Captcha Validation**: Validates extracted text (must be exactly 6 lowercase alphanumeric characters)
5. **Form Submission**: Types extracted captcha text and submits form
6. **Response Validation**: Checks if captcha was accepted or rejected by website
7. **Availability Check**: Parses response to determine appointment availability
8. **Notification**: Sends Telegram messages based on availability status
9. **Error Handling**: Automatically retries on captcha failures with detailed logging and image saving

### Critical Implementation Details

**Captcha Validation**: The system expects exactly 6 characters, lowercase letters and digits only (`/^[a-z0-9]{6}$/`). Invalid formats trigger immediate retry.

**Failed Captcha Tracking**: Failed captcha attempts are automatically saved with incremental filenames (`image1.jpg`, `image2.jpg`, etc.) along with metadata files containing extraction details, failure reasons, and timestamps.

**Timeout Management**: Each execution cycle has a 5-minute timeout (290 seconds) to prevent infinite hangs. Browser instances are properly closed on timeout.

**Retry Strategy**: The application distinguishes between different error types:
- **Extraction errors**: OCR failures or invalid format - sends debug image to Telegram
- **Captcha errors**: Wrong captcha submission - sends silent notification  
- **Other errors**: Navigation/timeout issues - sends error message to Telegram

### Testing and Debugging

**Captcha Accuracy Testing (src/testCaptchaAccuracy.ts)**:
- Analyzes all saved failed captcha images (`image1.jpg`, `image2.jpg`, etc.)
- Re-processes each image with current OCR algorithms
- Compares new extractions against original failed attempts
- Provides detailed accuracy statistics and improvement rates
- Saves comprehensive results to `captcha-accuracy-results.json`
- Useful for OCR algorithm refinement and debugging

**Failed Captcha Analysis**: The system automatically saves failed captchas with metadata including:
- Original extracted text
- Failure reason (format validation vs website rejection)
- Timestamp
- Sequential numbering for easy tracking

### Dependencies

- **puppeteer-extra**: Browser automation with stealth capabilities
- **chrome-lens-ocr**: OCR processing for captcha solving (with advanced image preprocessing)
- **grammy**: Telegram bot framework
- **node-cron**: Scheduled task execution
- **sharp**: Image processing and enhancement for improved OCR accuracy
- **dotenv**: Environment variable management

## Development Notes

### TypeScript Configuration
- Uses modern ES2017+ features with strict type checking
- Configured for both CommonJS (tsconfig.json) and ESNext (jsconfig.json)
- Source maps enabled for debugging

### Runtime Environment
- Runs on Bun runtime (preferred) or Node.js
- Headless browser execution with sandbox disabled for compatibility
- 5-minute internal cron schedule (`*/5 * * * *`) with 290-second timeout protection
- System cron configured for automatic startup on reboot via `start-checker.sh`

### Deployment and Monitoring
- **System Integration**: Uses system cron (@reboot) for persistent operation
- **Startup Script**: `start-checker.sh` handles environment setup and directory changes
- **Log Monitoring**: Logs output to `/tmp/appointment-checker.log`
- **Process Management**: Automatic restart on system reboot
- **Silent Notifications**: Captcha failures sent to Telegram without sound

### Notification Strategy
- **Silent Mode**: Regular checks and captcha failures (no notification sound)
- **Alert Mode**: Appointment availability (26 urgent messages for immediate attention)
- **Error Logging**: Both console and Telegram logging for troubleshooting

### Security Considerations
- All sensitive data (tokens, URLs) managed via environment variables
- Stealth mode prevents detection by anti-bot measures
- No hardcoded credentials in source code
- Telegram error handling prevents crashes from notification failures