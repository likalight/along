import { afterEach, expect, it, vi } from "vitest";
import { requestMicrophone } from "../lib/voice/microphone";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("releases a late microphone stream after an unanswered prompt times out", async () => {
  vi.useFakeTimers();
  let resolve!: (value: MediaStream) => void;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise<MediaStream>((r) => {
          resolve = r;
        }),
    },
  });
  const pending = requestMicrophone(new AbortController().signal, 100);
  const rejected = expect(pending).rejects.toThrow(
    "permission is still pending",
  );
  await vi.advanceTimersByTimeAsync(100);
  await rejected;
  const stop = vi.fn();
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await Promise.resolve();
  expect(stop).toHaveBeenCalledOnce();
});
it("stops late capture when the shopper cancels connection", async () => {
  let resolve!: (value: MediaStream) => void;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise<MediaStream>((r) => {
          resolve = r;
        }),
    },
  });
  const abort = new AbortController();
  const pending = requestMicrophone(abort.signal);
  const rejected = expect(pending).rejects.toThrow("cancelled");
  abort.abort();
  await rejected;
  const stop = vi.fn();
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await Promise.resolve();
  expect(stop).toHaveBeenCalledOnce();
});
