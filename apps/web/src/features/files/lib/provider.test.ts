import { afterEach, describe, it, expect, vi } from "vitest";
import { deepSeekProvider, generateValidated, parseSse } from "./provider";
import { emptyContent } from "./content";
describe("structured AI output", () => {
  it("retries blank output once and validates content", async () => {
    let count = 0;
    const result = await generateValidated(async () =>
      ++count === 1
        ? " "
        : JSON.stringify({
            message: "Created",
            name: "Plan",
            content: emptyContent("document"),
          })
    );
    expect(count).toBe(2);
    expect(result.content.kind).toBe("document");
  });
  it("fails after two invalid outputs", async () => {
    let count = 0;
    await expect(
      generateValidated(async () => {
        count++;
        return '{"content":{}}';
      })
    ).rejects.toThrow();
    expect(count).toBe(2);
  });
  it("decodes split SSE records and UTF8 without losing text", async () => {
    const data = new TextEncoder().encode(
      'data: {"choices":[{"delta":{"content":"héllo"}}]}\n\ndata: [DONE]\n\n'
    );
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < data.length; i += 3)
          c.enqueue(data.slice(i, i + 3));
        c.close();
      },
    });
    expect(await parseSse(stream, () => {})).toBe("héllo");
  });
});

describe("DeepSeek streaming usage and failures", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const stream = (text: string) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  it("captures token usage from a usage-only SSE frame", async () => {
    const onUsage = vi.fn();
    const body =
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":4,"total_tokens":16}}\n\ndata: [DONE]\n\n';
    await expect(parseSse(stream(body), () => {}, onUsage)).resolves.toBe(
      "hello"
    );
    expect(onUsage).toHaveBeenCalledExactlyOnceWith({
      prompt_tokens: 12,
      completion_tokens: 4,
      total_tokens: 16,
    });
  });
  it("requests usage from DeepSeek and reports it after validated generation", async () => {
    const output = JSON.stringify({
      message: "Created",
      name: "Plan",
      content: emptyContent("document"),
    });
    const body = `data: ${JSON.stringify({ choices: [{ delta: { content: output } }] })}\n\ndata: {"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":10,"total_tokens":30}}\n\ndata: [DONE]\n\n`;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(stream(body), {
        headers: { "Content-Type": "text/event-stream" },
      })
    );
    vi.stubGlobal("fetch", fetcher);
    const onUsage = vi.fn();
    const provider = deepSeekProvider({
      apiKey: "test-private-key",
      model: "deepseek-flash",
      onUsage,
    });
    await expect(
      provider.generate(
        [{ role: "user", content: "Create a JSON document" }],
        () => {}
      )
    ).resolves.toMatchObject({ name: "Plan", content: { kind: "document" } });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(JSON.parse(options.body)).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      response_format: { type: "json_object" },
    });
    expect(onUsage).toHaveBeenCalledExactlyOnceWith({
      prompt_tokens: 20,
      completion_tokens: 10,
      total_tokens: 30,
    });
  });
  it("rejects an interrupted stream without a completion marker", async () => {
    await expect(
      parseSse(
        stream('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
        () => {}
      )
    ).rejects.toThrow("interrupted");
  });
  it("rejects token-limited output instead of saving partial JSON", async () => {
    await expect(
      parseSse(
        stream(
          'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'
        ),
        () => {}
      )
    ).rejects.toThrow("truncated");
  });
});

it("retries output with the wrong requested file kind", async () => {
  let count = 0;
  const result = await generateValidated(
    async () =>
      JSON.stringify({
        message: "Made",
        name: "Workbook",
        content: emptyContent(++count === 1 ? "document" : "spreadsheet"),
      }),
    "spreadsheet"
  );
  expect(count).toBe(2);
  expect(result.content.kind).toBe("spreadsheet");
});
