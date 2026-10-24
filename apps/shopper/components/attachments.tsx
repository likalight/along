"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Link2, X, LoaderCircle } from "lucide-react";
import type { Attachment } from "@/lib/session/contract";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/attachments/limits";
type Item = {
  key: string;
  status: "loading" | "ready" | "error";
  name: string;
  asset?: Attachment;
  preview?: string;
  error?: string;
  previewFailed?: boolean;
};
export function Attachments({
  sessionId,
  acceptedIds,
  onUse,
  onInterrupt,
  onRemove,
}: {
  sessionId: string;
  acceptedIds: string[];
  onUse: (a: Attachment) => void;
  onInterrupt: () => void;
  onRemove: (a: Attachment) => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [link, setLink] = useState(""),
    [tray, setTray] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const removed = useRef(new Set<string>());
  const shared = useRef(new Set<string>());
  const pending = useRef(new Map<string, AbortController>());
  const previews = useRef(new Map<string, string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const request of pending.current.values()) request.abort();
      pending.current.clear();
      for (const preview of previews.current.values())
        URL.revokeObjectURL(preview);
      previews.current.clear();
    };
  }, []);
  async function discard(asset: Attachment) {
    // Active references are removed by the accepted-state command. This endpoint
    // frees unshared uploads without changing shopping decisions.
    try {
      await fetch("/api/attachments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, attachmentId: asset.id }),
      });
    } catch {
      /* Session expiry is the bounded cleanup fallback while offline. */
    }
  }
  async function upload(
    body: FormData | object,
    name: string,
    preview?: string,
  ) {
    onInterrupt();
    const key = crypto.randomUUID();
    const abort = new AbortController();
    pending.current.set(key, abort);
    if (preview) previews.current.set(key, preview);
    setItems((old) => [...old, { key, status: "loading", name, preview }]);
    try {
      const response = await fetch("/api/attachments", {
        method: "POST",
        signal: abort.signal,
        headers:
          body instanceof FormData
            ? undefined
            : { "Content-Type": "application/json" },
        body:
          body instanceof FormData
            ? body
            : JSON.stringify({ ...body, sessionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (
        !mounted.current ||
        removed.current.has(key) ||
        abort.signal.aborted
      ) {
        void discard(data);
        return;
      }
      setItems((old) =>
        old.map((i) =>
          i.key === key ? { ...i, status: "ready", asset: data } : i,
        ),
      );
    } catch (e) {
      if (mounted.current && !removed.current.has(key) && !abort.signal.aborted)
        setItems((old) =>
          old.map((i) =>
            i.key === key
              ? {
                  ...i,
                  status: "error",
                  error:
                    e instanceof Error
                      ? e.message
                      : "Upload failed. Try again.",
                }
              : i,
          ),
        );
    } finally {
      pending.current.delete(key);
    }
  }
  function file(event: ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    if (
      !(IMAGE_TYPES as readonly string[]).includes(f.type) ||
      f.size > MAX_IMAGE_BYTES ||
      !f.size
    ) {
      setItems((old) => [
        ...old,
        {
          key: crypto.randomUUID(),
          name: f.name,
          status: "error",
          error: "Choose a JPG, PNG or WebP image of 2 MiB or less.",
        },
      ]);
      return;
    }
    const form = new FormData();
    form.set("file", f);
    form.set("sessionId", sessionId);
    void upload(form, f.name, URL.createObjectURL(f));
  }
  return (
    <div className="attachments">
      <div className="attachment-actions">
        <button type="button" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={16} /> Add a photo
        </button>
        <button
          type="button"
          aria-expanded={tray}
          aria-controls="reference-link-tray"
          onClick={() => setTray(!tray)}
        >
          <Link2 size={16} /> Add a link
        </button>
        <button
          type="button"
          onClick={() =>
            void upload({ kind: "prepared" }, "Prepared blue tote illustration")
          }
        >
          Use prepared image
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={file}
        hidden
        aria-label="Upload reference photo"
      />
      {tray && (
        <div className="link-entry" id="reference-link-tray">
          <label htmlFor="reference-link">Product or reference link</label>
          <div className="input-row">
            <input
              id="reference-link"
              type="url"
              maxLength={2048}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c"
            />
            <button
              type="button"
              disabled={!link.trim()}
              onClick={() =>
                void upload(
                  { kind: "link", url: link.trim() },
                  "Link reference",
                )
              }
            >
              Resolve link
            </button>
          </div>
          <small>
            {link.trim() ===
            "https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c"
              ? "Supported prepared reference"
              : "Use a product source link from our catalog. Other links are unavailable in this bounded demo."}
          </small>
        </div>
      )}
      <ul className="attachment-list" aria-label="References">
        {items.map((i) => (
          <li key={i.key} aria-busy={i.status === "loading"}>
            {!i.previewFailed &&
              (i.preview || (i.asset?.kind === "image" && i.asset.url)) && (
                <img
                  src={i.preview ?? i.asset?.url}
                  alt={`Preview: ${i.name}`}
                  onError={() => {
                    pending.current.get(i.key)?.abort();
                    if (i.asset) void discard(i.asset);
                    setItems((old) =>
                      old.map((item) =>
                        item.key === i.key
                          ? {
                              ...item,
                              status: "error",
                              previewFailed: true,
                              error:
                                "This image could not be previewed. Remove it and choose another photo.",
                            }
                          : item,
                      ),
                    );
                  }}
                />
              )}
            <div>
              <strong>{i.name}</strong>
              <span role="status" aria-live="polite" aria-atomic="true">
                {i.status === "loading" ? (
                  <>
                    <LoaderCircle size={14} className="spin" />{" "}
                    {i.name === "Link reference"
                      ? "Resolving link…"
                      : "Preparing image…"}
                  </>
                ) : i.status === "error" ? (
                  i.error
                ) : i.asset && acceptedIds.includes(i.asset.id) ? (
                  "Shared with the conversation"
                ) : i.asset?.kind === "link" ? (
                  "Supported · prepared reference"
                ) : (
                  "Ready · preview only"
                )}
              </span>
              {i.status === "ready" && (
                <button
                  type="button"
                  disabled={!!i.asset && acceptedIds.includes(i.asset.id)}
                  onClick={() => {
                    shared.current.add(i.key);
                    onUse(i.asset!);
                  }}
                >
                  {i.asset && acceptedIds.includes(i.asset.id)
                    ? "Shared reference"
                    : "Share with concierge"}
                </button>
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${i.name}`}
              onClick={() => {
                onInterrupt();
                removed.current.add(i.key);
                pending.current.get(i.key)?.abort();
                pending.current.delete(i.key);
                if (i.preview) URL.revokeObjectURL(i.preview);
                previews.current.delete(i.key);
                if (i.asset) {
                  if (shared.current.has(i.key)) onRemove(i.asset);
                  void discard(i.asset);
                }
                shared.current.delete(i.key);
                setItems((old) => old.filter((x) => x.key !== i.key));
              }}
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
