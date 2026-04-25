/**
 * Global fetch mock — tests register matchers and we dispatch to them. Used
 * for the Cartesia voices proxy.
 */

type Handler = (
  url: URL,
  init?: RequestInit,
) => Response | Promise<Response>;

type Matcher = {
  match: (url: URL, init?: RequestInit) => boolean;
  handler: Handler;
};

const matchers: Matcher[] = [];

export function resetFetchMock() {
  matchers.length = 0;
}

export function onFetch(
  predicate: (url: URL, init?: RequestInit) => boolean,
  handler: Handler,
) {
  matchers.push({ match: predicate, handler });
}

export function installFetchMock() {
  const original = globalThis.fetch;
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const url = new URL(urlStr);

    // Let local Hono test requests hit the real fetch path (they don't go
    // through global fetch because Hono's app.request handles them directly),
    // so this guard is mostly belt-and-braces.
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return original(input as RequestInfo, init);
    }

    for (const m of matchers) {
      if (m.match(url, init)) {
        return await m.handler(url, init);
      }
    }

    return new Response(`unhandled fetch to ${url.toString()}`, {
      status: 599,
    });
  }) as typeof fetch;
}
