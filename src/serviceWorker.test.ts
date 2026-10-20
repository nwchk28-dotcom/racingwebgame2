import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function worker() {
  const listeners: Record<string, (event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void> = {};
  const scope = 'https://example.github.io/racingwebgame2/';
  const files = new Map<string, Response>();
  const resolve = (request: Request | string) => typeof request === 'string' ? new URL(request, scope).href : request.url;
  let online = true;
  const self = { location: new URL(`${scope}sw.js`), registration: { scope },
    addEventListener: (name: string, handler: typeof listeners[string]) => { listeners[name] = handler; } };
  const caches = { open: async () => ({
    match: async (request: Request | string) => files.get(resolve(request))?.clone(),
    put: async (request: Request | string, response: Response) => { files.set(resolve(request), response); },
  }) };
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self, caches, URL, Response,
    fetch: async () => { if (!online) throw Error('offline'); return new Response('current'); },
  });
  return { scope, files, setOffline: () => { online = false; },
    fetch: (request: Request): Promise<Response> | null => {
      let response: Promise<Response> | null = null;
      listeners.fetch({ request, respondWith: value => { response = value; } });
      return response;
    },
  };
}

describe('Pages-scoped web-app worker', () => {
  it('refreshes navigation online and provides the scoped shell offline', async () => {
    const w = worker();
    const navigation = new Request(w.scope);
    Object.defineProperty(navigation, 'mode', { value: 'navigate' });
    w.files.set(w.scope, new Response('old'));
    expect(await (await w.fetch(navigation))!.text()).toBe('current');
    w.setOffline();
    expect(await (await w.fetch(navigation))!.text()).toBe('current');
  });
  it('refreshes a previously cached install name and icon online, retaining offline metadata', async () => {
    for (const file of ['manifest.webmanifest', 'manifest.webmanifest?v=formula-q-3', 'app-180.png', 'app-192.png', 'app-512.png']) {
      const w = worker(), request = new Request(new URL(file, w.scope));
      w.files.set(request.url, new Response('old install metadata'));
      expect(await (await w.fetch(request))!.text()).toBe('current');
      w.setOffline();
      expect(await (await w.fetch(request))!.text()).toBe('current');
    }
  });
  it('does not return HTML for an uncached manifest while offline', async () => {
    const w = worker();
    w.files.set(w.scope, new Response('<html>shell</html>'));
    w.setOffline();
    expect((await w.fetch(new Request(new URL('manifest.webmanifest', w.scope))))!.type).toBe('error');
  });
  it('leaves external and other-project requests outside its cache', () => {
    const w = worker();
    expect(w.fetch(new Request('https://fonts.googleapis.com/css'))).toBeNull();
    expect(w.fetch(new Request('https://example.github.io/another-project/'))).toBeNull();
  });
});
