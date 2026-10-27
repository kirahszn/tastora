// Newline-delimited JSON, as sent by POST /api/recommend?stream=1.

export class NdjsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NdjsonError";
  }
}

/** Incremental parser: feed text chunks as they arrive (lines may span chunks). */
export function createNdjsonParser() {
  let buffer = "";
  const parseLine = (line: string): unknown[] => {
    const trimmed = line.trim();
    if (!trimmed) return [];
    try {
      return [JSON.parse(trimmed)];
    } catch {
      throw new NdjsonError("Malformed line in progress stream");
    }
  };
  return {
    push(chunk: string): unknown[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      return lines.flatMap(parseLine);
    },
    /** Parse whatever is left after the stream ends. */
    flush(): unknown[] {
      const rest = buffer;
      buffer = "";
      return parseLine(rest);
    },
  };
}

/** Read a byte stream to the end, calling `onEvent` for each parsed line as it arrives. */
export async function readNdjson(body: ReadableStream<Uint8Array>, onEvent: (event: unknown) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createNdjsonParser();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true })).forEach(onEvent);
  }
  parser.push(decoder.decode()).forEach(onEvent);
  parser.flush().forEach(onEvent);
}
