require('dotenv').config({ path: require('path').resolve(__dirname, '.env.production') });
const { chat } = require('./src/services/llmClient');

async function testOpenRouter() {
  try {
    console.log('Testing OpenRouter API...');
    const messages = [{ role: 'user', content: 'Hello, OpenRouter!' }];
    console.log('Messages:', messages);
    const response = await chat(messages, 'openrouter');
    console.log('Raw response:', response);
    console.log('OpenRouter API Test Successful. Response:', response);
  } catch (error) {
    console.error('OpenRouter API Test Failed:', error.message);
  }
}

testOpenRouter();