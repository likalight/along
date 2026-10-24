"use client";
import { useRef, useState, type ChangeEvent } from "react";
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
  onUse,
  onInterrupt,
  onRemove,
}: {
  sessionId: string;
  onUse: (a: Attachment) => void;
  onInterrupt: () => void;
  onRemove: (a: Attachment) => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [link, setLink] = useState(""),
    [tray, setTray] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const removed = useRef(new Set<string>());
  async function upload(
    body: FormData | object,
    name: string,
    preview?: string,
  ) {
    onInterrupt();
    const key = crypto.randomUUID();
    setItems((old) => [...old, { key, status: "loading", name, preview }]);
    try {
      const response = await fetch("/api/attachments", {
        method: "POST",
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
      if (removed.current.has(key)) return;
      setItems((old) =>
        old.map((i) =>
          i.key === key ? { ...i, status: "ready", asset: data } : i,
        ),
      );
    } catch (e) {
      if (!removed.current.has(key))
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
    const reader = new FileReader();
    reader.onload = () => void upload(form, f.name, String(reader.result));
    reader.readAsDataURL(f);
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
        <div className="link-entry">
          <label htmlFor="reference-link">Product or reference link</label>
          <div className="input-row">
            <input
              id="reference-link"
              type="url"
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
          <li key={i.key}>
            {(i.preview || (i.asset?.kind === "image" && i.asset?.url)) && (
              <img src={i.preview ?? i.asset?.url} alt={`Preview: ${i.name}`} />
            )}
            <div>
              <strong>{i.name}</strong>
              <span role="status">
                {i.status === "loading" ? (
                  <>
                    <LoaderCircle size={14} className="spin" />{" "}
                    {i.name === "Link reference"
                      ? "Resolving link…"
                      : "Preparing image…"}
                  </>
                ) : i.status === "error" ? (
                  i.error
                ) : i.asset?.kind === "link" ? (
                  "Supported · prepared reference"
                ) : (
                  "Ready · preview only"
                )}
              </span>
              {i.status === "ready" && (
                <button type="button" onClick={() => onUse(i.asset!)}>
                  Share with concierge
                </button>
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove ${i.name}`}
              onClick={() => {
                removed.current.add(i.key);
                if (i.asset) onRemove(i.asset);
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
