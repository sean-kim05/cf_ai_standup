export class StandupMemory {
  constructor(state, env) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/history') {
      const history = (await this.state.storage.get('standups')) || [];
      return Response.json(history.slice(-7));
    }

    if (request.method === 'POST' && url.pathname === '/add') {
      const entry = await request.json();
      const history = (await this.state.storage.get('standups')) || [];
      history.push(entry);
      await this.state.storage.put('standups', history.slice(-100));
      return Response.json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  }
}
