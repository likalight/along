/** A dismissed or unanswered browser permission prompt must not freeze the app.
 * getUserMedia cannot be aborted; stop any stream it resolves after timeout. */
export function requestMicrophone(
  signal: AbortSignal,
  timeoutMs = 20000,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(error);
    };
    const cancel = () => finish(new Error("Voice connection cancelled."));
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Microphone permission is still pending. Allow it in your browser, then retry, or continue by typing.",
          ),
        ),
      timeoutMs,
    );
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) {
      cancel();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then(
        (stream) => {
          if (finished) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          finished = true;
          clearTimeout(timer);
          signal.removeEventListener("abort", cancel);
          resolve(stream);
        },
        (error) =>
          finish(
            error instanceof Error
              ? error
              : new Error("Microphone unavailable."),
          ),
      );
  });
}
