/**
 * The prompt and version clients send the NeuroForge token, not x-user-id.
 *
 * NeuroForge takes a workbench prompt's owner from a verified Bearer token and no
 * longer trusts an x-user-id header (NeuroForge NF-UNAUTHENTICATED-MODEL-ROUTES-20261027).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { token } from "$lib/auth";
import { createPrompt, listPrompts } from "./promptsClient";
import { versionsClient } from "./versionsClient";

const TOKEN = "header.payload.signature";

function headersOf(call: unknown[]): Record<string, string> {
  const init = (call[1] ?? {}) as RequestInit;
  return (init.headers ?? {}) as Record<string, string>;
}

describe("workbench clients send the NeuroForge token", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ prompts: [], total: 0, versions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    token.set(TOKEN);
  });

  afterEach(() => {
    token.set(null);
    vi.unstubAllGlobals();
  });

  it("sends Authorization and no x-user-id on prompt calls", async () => {
    await createPrompt({ name: "p", basePrompt: "x" } as never, "someone-else");
    await listPrompts({}, "someone-else");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const headers = headersOf(call);
      expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(headers["x-user-id"]).toBeUndefined();
    }
  });

  it("sends Authorization and no x-user-id on version calls", async () => {
    await versionsClient.createVersion("p1", { content: "x" } as never);
    await versionsClient.listVersions("p1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const headers = headersOf(call);
      expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(headers["x-user-id"]).toBeUndefined();
    }
  });
});
