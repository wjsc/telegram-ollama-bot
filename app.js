const TelegramBot = require('node-telegram-bot-api');
const { Ollama } = require('ollama') 
const fs = require('fs');
const path = require('path');
const ollama = new Ollama({host: process.env.OLLAMA_HOST})

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {polling: true});

// Memory management configuration
const MEMORY_FILE = 'bot_memory.json';
const MAX_MEMORY_SIZE = 30000; // characters per chat
const MAX_CHATS = 100; // maximum number of chats to keep in memory
const MEMORY_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Memory storage class
class MemoryManager {
  constructor() {
    this.memory = new Map();
    this.lastCleanup = Date.now();
    this.loadMemory();
    this.startCleanupTimer();
  }

  // Load memory from disk
  loadMemory() {
    try {
      if (fs.existsSync(MEMORY_FILE)) {
        const data = fs.readFileSync(MEMORY_FILE, 'utf8');
        const memoryData = JSON.parse(data);
        this.memory = new Map(memoryData);
        console.log(`📚 Loaded memory for ${this.memory.size} chats`);
      }
    } catch (error) {
      console.error('❌ Error loading memory:', error.message);
      this.memory = new Map();
    }
  }

  // Save memory to disk
  saveMemory() {
    try {
      const memoryData = Array.from(this.memory.entries());
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryData, null, 2));
      console.log(`💾 Saved memory for ${this.memory.size} chats`);
    } catch (error) {
      console.error('❌ Error saving memory:', error.message);
    }
  }

  // Get memory for a chat
  getMemory(chatId) {
    return this.memory.get(chatId) || '';
  }

  // Update memory for a chat
  updateMemory(chatId, userMessage, botResponse) {
    const currentMemory = this.getMemory(chatId);
    const newEntry = `User: ${userMessage}\nBot: ${botResponse}`;
    
    let updatedMemory = currentMemory + '\n' + newEntry;
    
    // Truncate if too long
    if (updatedMemory.length > MAX_MEMORY_SIZE) {
      updatedMemory = updatedMemory.slice(-MAX_MEMORY_SIZE);
    }
    
    this.memory.set(chatId, updatedMemory);
    this.saveMemory();
  }

  // Clean up old conversations
  cleanup() {
    const now = Date.now();
    const cutoffTime = now - MEMORY_CLEANUP_INTERVAL;
    
    // Remove chats that haven't been active recently
    for (const [chatId, memory] of this.memory.entries()) {
      if (memory.lastActivity && memory.lastActivity < cutoffTime) {
        this.memory.delete(chatId);
        console.log(`🧹 Cleaned up memory for chat ${chatId}`);
      }
    }

    // If still too many chats, remove oldest ones
    if (this.memory.size > MAX_CHATS) {
      const entries = Array.from(this.memory.entries());
      entries.sort((a, b) => (a[1].lastActivity || 0) - (b[1].lastActivity || 0));
      
      const toRemove = entries.slice(0, entries.length - MAX_CHATS);
      toRemove.forEach(([chatId]) => {
        this.memory.delete(chatId);
        console.log(`🗑️ Removed old chat memory: ${chatId}`);
      });
    }

    this.lastCleanup = now;
    this.saveMemory();
  }

  // Start cleanup timer
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, MEMORY_CLEANUP_INTERVAL);
  }

  // Get memory stats
  getStats() {
    return {
      totalChats: this.memory.size,
      totalSize: JSON.stringify(Array.from(this.memory.entries())).length,
      lastCleanup: this.lastCleanup
    };
  }
}

// Initialize memory manager
const memoryManager = new MemoryManager();

console.log('🚀 Telegram Bot starting...');
console.log('🔗 Connecting to Ollama at:', process.env.OLLAMA_HOST);

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

bot.on('webhook_error', (error) => {
  console.error('❌ Webhook error:', error.message);
});

console.log('✅ Bot is ready and listening for messages...');

bot.onText(/\/echo (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const resp = match[1];
  bot.sendMessage(chatId, resp);
});

// Add memory stats command
bot.onText(/\/memory/, (msg) => {
  const chatId = msg.chat.id;
  const stats = memoryManager.getStats();
  const response = `📊 Memory Stats:\n` +
    `• Total chats: ${stats.totalChats}\n` +
    `• Total size: ${(stats.totalSize / 1024).toFixed(2)} KB\n` +
    `• Last cleanup: ${new Date(stats.lastCleanup).toLocaleString()}`;
  bot.sendMessage(chatId, response);
});

// Add memory clear command
bot.onText(/\/clearmemory/, (msg) => {
  const chatId = msg.chat.id;
  memoryManager.memory.delete(chatId);
  memoryManager.saveMemory();
  bot.sendMessage(chatId, '🧹 Memory cleared for this chat.');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  console.log('📨 Received message from chat ID:', chatId);
  console.log('👤 User:', msg.from?.first_name || 'Unknown', '(@' + (msg.from?.username || 'no-username') + ')');
  
  const systemPromt = process.env.SYSTEM_PROMPT

  const userPrompt = msg.text
  
  // Get conversation memory
  const conversationMemory = memoryManager.getMemory(chatId);
  const rememberPrompt = conversationMemory ? `DO NOT FORGET PREVIOUS CONVERSATION:\n${conversationMemory}` : "";
  
  const newPrompt = [
    {
      role: "system",
      content: systemPromt
    },
    {
      role: "system",
      content: rememberPrompt
    },
    {
      role: "user",
      content: userPrompt
    }
  ]

  console.log('🤖 Processing AI response...');
  
  // qwen2.5-coder:7b-instruct
  try {
    const response = await ollama.chat({
      model: process.env.MODEL,
      messages: newPrompt,
      think: false
    })
    
    console.log('🤖 Bot System Prompt:', rememberPrompt)
    console.log('👤 User Message:', userPrompt)
    console.log('🤖 Bot Response:', response.message.content)
    
    console.log('📤 Sending response to user...');
    bot.sendMessage(chatId, response.message.content);
    console.log('✅ Response sent successfully!');
    
    // Update memory with new conversation
    memoryManager.updateMemory(chatId, userPrompt, response.message.content);
    
  } catch (error) {
    console.error('❌ Error processing message:', error.message);
    bot.sendMessage(chatId, 'Lo siento, tengo un problema técnico en este momento.');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Saving memory before shutdown...');
  memoryManager.saveMemory();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔄 Saving memory before shutdown...');
  memoryManager.saveMemory();
  process.exit(0);
});