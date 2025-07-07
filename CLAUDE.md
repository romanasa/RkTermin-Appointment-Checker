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
- Advanced OCR system with 6 preprocessing strategies (Original, Ultra Enhanced, Super Contrast, Mega Sharp, Clean BW, Inverted)
- Multiple character correction algorithms (conservative, aggressive, numbers, letters)
- Intelligent result scoring and ranking system
- Handles complex captcha patterns with 40%+ accuracy rate
- Processes base64-encoded captcha images with sharp image enhancement
- Comprehensive logging of OCR attempts and success/failure rates

**Utilities (src/utils.ts)**:
- Provides delay function for timing control
- Exports bot token from environment variables

### Key Workflow

1. **Browser Automation**: Launches headless Chrome with stealth mode
2. **Captcha Handling**: Extracts captcha image, saves as base64, processes with advanced OCR
3. **OCR Processing**: Uses 6 different preprocessing strategies and multiple correction algorithms
4. **Form Submission**: Types extracted captcha text and submits form
5. **Captcha Validation**: Checks if captcha was accepted or rejected by website
6. **Availability Check**: Parses response to determine appointment availability
7. **Notification**: Sends Telegram messages based on availability status
8. **Error Handling**: Automatically retries on captcha failures with detailed logging

### Error Handling Strategy

The application implements comprehensive error handling:
- **Extraction errors**: OCR failures or invalid captcha text
- **Captcha errors**: Wrong captcha submission with silent Telegram notifications
- **Navigation errors**: Page loading or form submission issues
- **Timeout handling**: 5-minute execution limit with graceful cleanup
- **Automatic retries**: Continuous retry mechanism for captcha failures
- **Silent logging**: Failed captcha attempts logged to Telegram without notifications

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
- Runs on Node.js with npm/npx
- Headless browser execution with sandbox disabled
- 5-minute internal cron schedule with timeout protection
- System cron configured for automatic startup on reboot

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