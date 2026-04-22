import { StandupMemory } from './standupMemory.js';
export { StandupMemory };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

function getStub(env, userId) {
  const id = env.STANDUP_MEMORY.idFromName(userId);
  return env.STANDUP_MEMORY.get(id);
}

async function formatStandup(env, message) {
  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      {
        role: 'system',
        content: `You are a standup formatter. Convert the user's message into a daily standup using exactly this format — no extra text, no markdown, no asterisks:

Yesterday: [what was accomplished]
Today: [what is planned]
Blockers: [any blockers, or "None" if there are none]`,
      },
      { role: 'user', content: message },
    ],
  });
  return result.response;
}

async function generateWeeklySummary(env, standups) {
  const text = standups
    .map((s, i) => `Day ${i + 1} (${s.date}):\n${s.summary}`)
    .join('\n\n');

  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      {
        role: 'system',
        content:
          'You are a weekly work summary generator. Given daily standups, write a concise weekly summary covering: key accomplishments, ongoing work, and any recurring blockers. Be professional and to the point.',
      },
      {
        role: 'user',
        content: `Here are this week's standups:\n\n${text}\n\nGenerate a weekly summary.`,
      },
    ],
  });
  return result.response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    try {
      // POST /api/standup
      if (path === '/api/standup' && request.method === 'POST') {
        const { userId, message } = await request.json();
        if (!userId || !message) {
          return json({ error: 'userId and message are required' }, 400);
        }

        const summary = await formatStandup(env, message);
        const entry = {
          date: new Date().toISOString().split('T')[0],
          raw: message,
          summary,
        };

        const stub = getStub(env, userId);
        await stub.fetch('http://do/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });

        return json(entry);
      }

      // GET /api/history/:userId
      if (path.startsWith('/api/history/') && request.method === 'GET') {
        const userId = decodeURIComponent(path.replace('/api/history/', ''));
        if (!userId) return json({ error: 'userId required' }, 400);

        const stub = getStub(env, userId);
        const res = await stub.fetch('http://do/history');
        const history = await res.json();
        return json(history);
      }

      // POST /api/weekly/:userId
      if (path.startsWith('/api/weekly/') && request.method === 'POST') {
        const userId = decodeURIComponent(path.replace('/api/weekly/', ''));
        if (!userId) return json({ error: 'userId required' }, 400);

        const stub = getStub(env, userId);
        const res = await stub.fetch('http://do/history');
        const history = await res.json();

        if (history.length === 0) {
          return json({ error: 'No standups recorded yet' }, 400);
        }

        const summary = await generateWeeklySummary(env, history);
        return json({ summary });
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'Internal server error', detail: err.message }, 500);
    }
  },
};
