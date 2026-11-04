import "server-only";
import { z } from "zod";
import { validateContent, nameSchema } from "./content";
import type { FileContent, FileKind } from "../types";
export type Generation = {
  message: string;
  name: string;
  content: FileContent;
};
export interface FileAIProvider {
  generate(
    messages: { role: string; content: string }[],
    onText: (text: string) => void
  ): Promise<Generation>;
}
export async function generateValidated(
  call: (attempt: number) => Promise<string>,
  expectedKind?: FileKind
): Promise<Generation> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await call(attempt);
      if (!text.trim()) throw new Error("Blank output");
      const data = z
        .object({
          message: z.string().min(1).max(10_000),
          name: nameSchema,
          content: z.unknown(),
        })
        .parse(JSON.parse(text));
      const content = validateContent(data.content);
      if (expectedKind && content.kind !== expectedKind)
        throw new Error("AI returned the wrong file type");
      return { ...data, content };
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new Error("Invalid AI output");
}
export async function parseSse(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => void,
  onUsage?: (usage: Record<string, number>) => void
): Promise<string> {
  const reader = stream.getReader(),
    decoder = new TextDecoder();
  let pending = "",
    output = "",
    finished = false;
  function consume(line: string) {
    if (!line.startsWith("data:")) return;
    const body = line.slice(5).trim();
    if (body === "[DONE]") {
      finished = true;
      return;
    }
    if (!body) return;
    const event = JSON.parse(body);
    if (event.error) throw new Error("AI provider returned an error");
    if (event.usage && onUsage) onUsage(event.usage);
    const choice = event.choices?.[0];
    if (choice?.finish_reason === "length")
      throw new Error("AI output was truncated");
    const token = choice?.delta?.content;
    if (typeof token === "string") {
      output += token;
      if (output.length > 8_000_000) throw new Error("AI output exceeds limit");
      onText(token);
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) consume(line);
      if (done) {
        if (pending) consume(pending);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!finished) throw new Error("AI stream was interrupted");
  return output;
}
export function deepSeekProvider(config: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  onUsage?: (usage: Record<string, number>) => void;
  expectedKind?: FileKind;
}): FileAIProvider {
  return {
    async generate(messages, onText) {
      return generateValidated(async (attempt) => {
        const response = await fetch(
          `${config.baseUrl ?? "https://api.deepseek.com"}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: config.model,
              messages: attempt
                ? [
                    ...messages,
                    {
                      role: "user",
                      content:
                        "Return valid JSON matching the provided example. Your previous response was empty or invalid.",
                    },
                  ]
                : messages,
              response_format: { type: "json_object" },
              stream: true,
              stream_options: { include_usage: true },
              max_tokens: 8192,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        );
        if (!response.ok || !response.body)
          throw new Error("AI provider unavailable");
        return parseSse(response.body, onText, config.onUsage);
      }, config.expectedKind);
    },
  };
}
