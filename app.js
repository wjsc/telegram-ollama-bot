const TelegramBot = require('node-telegram-bot-api');
const { Ollama } = require('ollama') 
const ollama = new Ollama({host: process.env.OLLAMA_HOST})

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {polling: true});

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

const memory = new Map()

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  console.log('📨 Received message from chat ID:', chatId);
  console.log('👤 User:', msg.from?.first_name || 'Unknown', '(@' + (msg.from?.username || 'no-username') + ')');
  
  const systemPromt = 'You are a Telegram bot and a helpful assistant that can answer questions and help with tasks .'

  const userPrompt = msg.text
  
  let rememberPrompt = ""

  if(!memory.has(chatId)) {
    memory.set(chatId, "")
  }
  else{
    rememberPrompt = "DO NOT FORGET PREVIOUS CONVERSATION: \n" + memory.get(chatId)
  }
  
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
    
    memory.set(chatId, [
      memory.get(chatId),
      "user said:" + userPrompt, 
      "you responded:" + response.message.content].join('\n').slice(-30000)  + "\n"
    )
  } catch (error) {
    console.error('❌ Error processing message:', error.message);
    bot.sendMessage(chatId, 'Lo siento, tengo un problema técnico en este momento.');
  }
});