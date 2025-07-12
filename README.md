# Telegram AI Bot

A Telegram bot powered by Ollama that provides AI assistance with conversation memory.

## Features

- 🤖 AI-powered responses using Ollama
- 💬 Conversation memory across sessions
- 📝 Echo command for testing
- 🔄 Persistent chat history (up to 30,000 characters)

## Prerequisites

- Node.js (v14 or higher)
- Ollama running locally or remotely
- Telegram Bot Token

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd telegram-interface
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OLLAMA_HOST=http://localhost:11434
MODEL=qwen2.5-coder:7b-instruct
```

## Environment Variables

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from [@BotFather](https://t.me/botfather)
- `OLLAMA_HOST`: Ollama server URL (default: `http://localhost:11434`)
- `MODEL`: Ollama model to use (default: `qwen2.5-coder:7b-instruct`)

## Usage

1. Start the bot:
```bash
node app.js
```

2. The bot will start polling for messages and respond to:
   - Any text message (processed by AI)
   - `/echo <message>` command (returns the message as-is)

## How it Works

- The bot maintains conversation memory for each chat using a Map
- Each user's conversation history is preserved (up to 30,000 characters)
- AI responses are generated using the specified Ollama model
- System prompts include conversation context for continuity

## Commands

- `/echo <message>` - Echo back the provided message
- Any other text - Processed by AI with conversation context

## Error Handling

- Polling and webhook errors are logged
- AI processing errors return a Spanish error message
- Connection issues with Ollama are handled gracefully

## Dependencies

- `node-telegram-bot-api` - Telegram Bot API wrapper
- `ollama` - Ollama client for AI model interactions

## License

[Add your license here] 