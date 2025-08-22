const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

async function askTutor(message, history = []) {
  try {
    // Prefer chat endpoint if available
    const payload = {
      model: OLLAMA_MODEL,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
      stream: false,
    };
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    const reply = data?.message?.content || data?.response || 'Sorry, no response.';
    return { reply };
  } catch (err) {
    // Fallback: echo style
    return { reply: `Tutor (fallback): ${message}` };
  }
}

module.exports = { askTutor };


