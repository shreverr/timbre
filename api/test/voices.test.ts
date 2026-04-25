import { beforeEach, describe, expect, test } from "bun:test";
import { onFetch, resetFetchMock } from "./mocks/fetch.mock";
import { authedFetch, buildApp, USER_A } from "./helpers";

const app = buildApp();

beforeEach(() => {
  resetFetchMock();
});

describe("GET /voices", () => {
  test("forwards filters and strips preview_file_url from response", async () => {
    let capturedUrl: URL | null = null;
    let capturedAuth: string | null = null;
    let capturedVersion: string | null = null;

    onFetch(
      (url) =>
        url.hostname === "api.cartesia.ai" && url.pathname === "/voices",
      (url, init) => {
        capturedUrl = url;
        const headers = new Headers(init?.headers);
        capturedAuth = headers.get("Authorization");
        capturedVersion = headers.get("Cartesia-Version");
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "v1",
                name: "Voice 1",
                description: "",
                gender: "feminine",
                language: "en",
                is_owner: false,
                is_public: true,
                created_at: "2026-01-01T00:00:00Z",
                preview_file_url: "https://files.cartesia.ai/v1/download",
              },
            ],
            has_more: false,
            next_page: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );

    const res = await authedFetch(
      app,
      "/voices?language=en&gender=feminine&limit=5",
      USER_A,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
      has_more: boolean;
    };

    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.id).toBe("v1");
    expect(body.data[0]?.preview_file_url).toBeUndefined();

    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl!.searchParams.get("language")).toBe("en");
    expect(capturedUrl!.searchParams.get("gender")).toBe("feminine");
    expect(capturedUrl!.searchParams.get("limit")).toBe("5");
    // expand[]=preview_file_url must always be added so preview URLs are present
    // in the upstream response (even though we strip them from ours).
    expect(capturedUrl!.searchParams.getAll("expand[]")).toContain(
      "preview_file_url",
    );

    expect(capturedAuth).toBe("Bearer test_cartesia_key");
    expect(capturedVersion).toBe("2026-03-01");
  });

  test("upstream non-2xx → 502", async () => {
    onFetch(
      (url) => url.hostname === "api.cartesia.ai",
      () => new Response("nope", { status: 500 }),
    );
    const res = await authedFetch(app, "/voices", USER_A);
    expect(res.status).toBe(502);
  });
});

describe("GET /voices/:id", () => {
  test("returns stripped voice", async () => {
    onFetch(
      (url) =>
        url.hostname === "api.cartesia.ai" &&
        url.pathname === "/voices/abc123",
      () =>
        new Response(
          JSON.stringify({
            id: "abc123",
            name: "Voice",
            description: "A voice",
            gender: "masculine",
            language: "en",
            is_owner: false,
            is_public: true,
            created_at: "2026-01-01T00:00:00Z",
            preview_file_url: "https://files.cartesia.ai/abc/download",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const res = await authedFetch(app, "/voices/abc123", USER_A);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { voice: Record<string, unknown> };
    expect(body.voice.id).toBe("abc123");
    expect(body.voice.preview_file_url).toBeUndefined();
  });

  test("404 from upstream → 404", async () => {
    onFetch(
      (url) => url.hostname === "api.cartesia.ai",
      () => new Response("not found", { status: 404 }),
    );
    const res = await authedFetch(app, "/voices/missing", USER_A);
    expect(res.status).toBe(404);
  });
});

describe("GET /voices/:id/preview", () => {
  test("generates TTS preview from voice metadata and streams audio back", async () => {
    let ttsBody: Record<string, unknown> | null = null;

    // First: voice meta lookup
    onFetch(
      (url) =>
        url.hostname === "api.cartesia.ai" &&
        url.pathname === "/voices/vox1",
      () =>
        new Response(
          JSON.stringify({
            id: "vox1",
            name: "Vox",
            description: "",
            gender: "feminine",
            language: "en",
            is_owner: false,
            is_public: true,
            created_at: "2026-01-01T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    // Then: TTS synthesis
    onFetch(
      (url) =>
        url.hostname === "api.cartesia.ai" && url.pathname === "/tts/bytes",
      async (_url, init) => {
        ttsBody = JSON.parse(init?.body as string);
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      },
    );

    const res = await authedFetch(app, "/voices/vox1/preview", USER_A);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf.length).toBe(4);

    expect(ttsBody).not.toBeNull();
    expect(ttsBody).toMatchObject({
      model_id: "sonic-3",
      language: "en",
      voice: { mode: "id", id: "vox1" },
    });
  });
});
