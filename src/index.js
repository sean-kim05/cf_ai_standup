import { StandupMemory } from './standupMemory.js';
export { StandupMemory };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

function getStub(env, key) {
  const id = env.STANDUP_MEMORY.idFromName(key);
  return env.STANDUP_MEMORY.get(id);
}

function getSystemPrompt(format) {
  if (format === 'bullets') {
    return `You are a standup formatter. Convert the user's message into a daily standup using exactly this format — no extra text, no asterisks:

• Yesterday:
  - [accomplished item]
• Today:
  - [planned item]
• Blockers:
  - [blocker, or "None"]`;
  }
  if (format === 'jira') {
    return `You are a standup formatter. Convert the user's message into a Jira-style standup using exactly this format — no extra text, no asterisks:

✅ Done: [completed items]
🔄 Doing: [in-progress items]
🚫 Blocked: [blockers, or "None"]`;
  }
  return `You are a standup formatter. Convert the user's message into a daily standup using exactly this format — no extra text, no markdown, no asterisks:

Yesterday: [what was accomplished]
Today: [what is planned]
Blockers: [any blockers, or "None" if there are none]`;
}

function streamStandup(env, message, format) {
  return env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    stream: true,
    messages: [
      { role: 'system', content: getSystemPrompt(format) },
      { role: 'user', content: message },
    ],
  });
}

async function generateWeeklySummary(env, standups) {
  const text = standups.map((s, i) => `Day ${i + 1} (${s.date}):\n${s.summary}`).join('\n\n');
  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: 'You are a weekly work summary generator. Given daily standups, write a concise weekly summary covering key accomplishments, ongoing work, and any recurring blockers. Be professional and brief.' },
      { role: 'user', content: `Here are this week's standups:\n\n${text}\n\nGenerate a weekly summary.` },
    ],
  });
  return result.response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      // POST /api/standup — streaming SSE
      if (path === '/api/standup' && request.method === 'POST') {
        const { userId, message, format = 'standard' } = await request.json();
        if (!userId || !message) return json({ error: 'userId and message are required' }, 400);

        const stub = getStub(env, userId);
        const date = new Date().toISOString().split('T')[0];
        const aiStream = await streamStandup(env, message, format);

        let fullResponse = '';
        const transform = new TransformStream({
          transform(chunk, controller) {
            const text = new TextDecoder().decode(chunk);
            for (const line of text.split('\n')) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const { response } = JSON.parse(line.slice(6));
                  if (response) fullResponse += response;
                } catch {}
              }
            }
            controller.enqueue(chunk);
          },
          async flush(controller) {
            const entry = { date, raw: message, summary: fullResponse.trim(), format };
            await stub.fetch('http://do/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(entry),
            });
            const finalChunk = new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'saved', entry })}\n\n`
            );
            controller.enqueue(finalChunk);
          },
        });

        return new Response(aiStream.pipeThrough(transform), {
          headers: { 'Content-Type': 'text/event-stream', ...CORS },
        });
      }

      // GET /api/history/:userId
      if (path.startsWith('/api/history/') && request.method === 'GET') {
        const userId = decodeURIComponent(path.replace('/api/history/', ''));
        if (!userId) return json({ error: 'userId required' }, 400);
        const stub = getStub(env, userId);
        const res = await stub.fetch('http://do/history');
        return json(await res.json());
      }

      // DELETE /api/standup/:userId/:index
      if (path.startsWith('/api/standup/') && request.method === 'DELETE') {
        const parts = path.replace('/api/standup/', '').split('/');
        const userId = decodeURIComponent(parts[0]);
        const index = parseInt(parts[1]);
        const stub = getStub(env, userId);
        await stub.fetch(`http://do/delete/${index}`, { method: 'DELETE' });
        return json({ ok: true });
      }

      // PUT /api/standup/:userId/:index
      if (path.startsWith('/api/standup/') && request.method === 'PUT') {
        const parts = path.replace('/api/standup/', '').split('/');
        const userId = decodeURIComponent(parts[0]);
        const index = parseInt(parts[1]);
        const { summary } = await request.json();
        const stub = getStub(env, userId);
        await stub.fetch(`http://do/update/${index}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary }),
        });
        return json({ ok: true });
      }

      // POST /api/weekly/:userId
      if (path.startsWith('/api/weekly/') && request.method === 'POST') {
        const userId = decodeURIComponent(path.replace('/api/weekly/', ''));
        if (!userId) return json({ error: 'userId required' }, 400);
        const stub = getStub(env, userId);
        const res = await stub.fetch('http://do/history');
        const history = await res.json();
        if (history.length === 0) return json({ error: 'No standups recorded yet' }, 400);
        const summary = await generateWeeklySummary(env, history);
        return json({ summary });
      }

      // GET /api/room/:roomId
      if (path.startsWith('/api/room/') && !path.includes('/standup') && request.method === 'GET') {
        const roomId = decodeURIComponent(path.replace('/api/room/', ''));
        const stub = getStub(env, `room_${roomId}`);
        const res = await stub.fetch('http://do/room-history');
        return json(await res.json());
      }

      // POST /api/room/:roomId/standup — streaming SSE for team rooms
      if (path.match(/^\/api\/room\/[^/]+\/standup$/) && request.method === 'POST') {
        const roomId = decodeURIComponent(path.replace('/api/room/', '').replace('/standup', ''));
        const { userName, userId, message, format = 'standard' } = await request.json();
        if (!userName || !message) return json({ error: 'userName and message are required' }, 400);

        const stub = getStub(env, `room_${roomId}`);
        const date = new Date().toISOString().split('T')[0];
        const aiStream = await streamStandup(env, message, format);

        let fullResponse = '';
        const transform = new TransformStream({
          transform(chunk, controller) {
            const text = new TextDecoder().decode(chunk);
            for (const line of text.split('\n')) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const { response } = JSON.parse(line.slice(6));
                  if (response) fullResponse += response;
                } catch {}
              }
            }
            controller.enqueue(chunk);
          },
          async flush(controller) {
            const entry = { date, userName, userId, raw: message, summary: fullResponse.trim(), format };
            await stub.fetch('http://do/room-add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(entry),
            });
            const finalChunk = new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'saved', entry })}\n\n`
            );
            controller.enqueue(finalChunk);
          },
        });

        return new Response(aiStream.pipeThrough(transform), {
          headers: { 'Content-Type': 'text/event-stream', ...CORS },
        });
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'Internal server error', detail: err.message }, 500);
    }
  },
};
