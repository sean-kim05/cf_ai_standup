export class StandupMemory {
  constructor(state, env) { this.state = state; }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Personal standups
    if (request.method === 'GET' && path === '/history') {
      const history = (await this.state.storage.get('standups')) || [];
      const last7 = history.slice(-7);
      const offset = history.length - last7.length;
      return Response.json(last7.map((e, i) => ({ ...e, index: offset + i })));
    }

    if (request.method === 'POST' && path === '/add') {
      const entry = await request.json();
      const history = (await this.state.storage.get('standups')) || [];
      history.push(entry);
      await this.state.storage.put('standups', history.slice(-100));
      return Response.json({ ok: true });
    }

    if (request.method === 'DELETE' && path.startsWith('/delete/')) {
      const index = parseInt(path.slice('/delete/'.length));
      const history = (await this.state.storage.get('standups')) || [];
      if (index < 0 || index >= history.length) return new Response('Out of range', { status: 400 });
      history.splice(index, 1);
      await this.state.storage.put('standups', history);
      return Response.json({ ok: true });
    }

    if (request.method === 'PUT' && path.startsWith('/update/')) {
      const index = parseInt(path.slice('/update/'.length));
      const { summary } = await request.json();
      const history = (await this.state.storage.get('standups')) || [];
      if (index < 0 || index >= history.length) return new Response('Out of range', { status: 400 });
      history[index] = { ...history[index], summary };
      await this.state.storage.put('standups', history);
      return Response.json({ ok: true });
    }

    // Team room standups
    if (request.method === 'GET' && path === '/room-history') {
      const history = (await this.state.storage.get('room_standups')) || [];
      return Response.json(history.slice(-100));
    }

    if (request.method === 'POST' && path === '/room-add') {
      const entry = await request.json();
      const history = (await this.state.storage.get('room_standups')) || [];
      history.push(entry);
      await this.state.storage.put('room_standups', history.slice(-200));
      return Response.json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  }
}
