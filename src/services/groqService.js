// src/services/groqService.js

export function getDefaultSystemPrompt() {
  return `You are a helpful CheckIn Care support assistant. Your role is to help users with their medication management.
Capabilities: Help with adding medications, reminders, adherence tracking, and navigating the app.
Tone: Friendly, empathetic, and encouraging.
Length: Keep responses short and concise (2-3 sentences maximum).
Medical: Redirect any medical questions to their healthcare provider. Do not give medical advice.
Features: Explain how to add medications, view schedule, log adherence, set reminders, view history, and edit medications.`;
}

export async function getGroqResponse(messages, systemPrompt) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const model = import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    throw new Error("API key not found. Please check your environment variables.");
  }

  const systemMessage = {
    role: 'system',
    content: systemPrompt || getDefaultSystemPrompt()
  };

  try {
    console.log("🚀 Calling Groq API (non-streaming)...");
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log("✅ Groq response received");
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("❌ Groq API Error:", error);
    throw new Error("Sorry, I'm having trouble connecting right now. Please try again later.");
  }
}

export async function getGroqResponseStream(messages, systemPrompt, onChunk) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const model = import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    throw new Error("API key not found. Please check your environment variables.");
  }

  const systemMessage = {
    role: 'system',
    content: systemPrompt || getDefaultSystemPrompt()
  };

  try {
    console.log("🚀 Calling Groq API (streaming)...");
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        max_tokens: 1024,
        stream: true,
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error (${response.status}): ${errText}`);
    }

    console.log("✅ Groq stream started");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {
            // Ignore parse errors on incomplete chunks
          }
        }
      }
    }
    console.log("✅ Groq stream complete");
    return fullResponse;
  } catch (error) {
    console.error("❌ Groq API Error:", error);
    throw new Error("Sorry, I'm having trouble connecting right now. Please try again later.");
  }
}
