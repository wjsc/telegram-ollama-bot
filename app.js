const TelegramBot = require('node-telegram-bot-api');
const { Ollama } = require('ollama') 
const ollama = new Ollama({host: 'http://127.0.0.1:11434'})

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {polling: true});

bot.onText(/\/echo (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const resp = match[1];
  bot.sendMessage(chatId, resp);
});

const memory = new Map()
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  const newPrompt = [
    { 
        role: 'system',
        content: 'Sos un bot de telegram que enseña a hablar portugues. Habla estrictamente idioma portugues de Brasil y ningun otro idioma. Si el usuario comete un error, corregir al usuario sin excepción.'
    },
    {
        role: 'user',
        content: msg.text
    }
  ]

  const response = await ollama.chat({
    model: 'qwen2.5-coder:7b-instruct',
    messages: [
      ...(memory.get(msg.chat.id) || []),
      ...newPrompt            
    ],
  })
  
  memory.set(msg.chat.id, [
    ...(memory.get(msg.chat.id) || []),
    ...newPrompt
  ].slice(-10) )

  bot.sendMessage(chatId, response.message.content);
});