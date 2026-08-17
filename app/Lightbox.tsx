"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Full-screen inspection of a try-on render.
 *
 * The render is the payoff of the whole product and it was only ever visible at
 * about 450px wide, inside a frame, behind a colour panel. Anyone deciding
 * whether a garment actually works on them zooms in - it is the first thing a
 * shopper does with a product photograph - and there was no way to.
 *
 * Two zoom states rather than a continuous control: FIT (the whole figure, which
 * is what you want for silhouette and colour) and ACTUAL (native pixels, which is
 * what you want for fabric and edges). A slider would be more flexible and worse:
 * these are the only two questions being asked.
 *
 * Keyboard: Enter/Space opens, Escape closes, and focus returns to the thumbnail
 * that opened it. Native pinch-zoom still works on top of ACTUAL because the
 * overlay scrolls rather than trapping the gesture.
 */
export function Lightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  caption?: string;
  onClose: () => void;
}) {
  const [actual, setActual] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Remember where focus came from and put it back on close. `Zoomable` does
    // this for its own trigger, but the rail opens a Lightbox directly, and a
    // guard that covers three of four callers is not a guard.
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while an overlay is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={(e) => {
        // Only the backdrop closes; clicks on the figure are for inspecting it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lightbox-bar">
        <button onClick={() => setActual((a) => !a)} aria-pressed={actual}>
          {actual ? "Fit to screen" : "Actual size"}
        </button>
        <button ref={closeRef} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={`lightbox-stage${actual ? " actual" : ""}`}>
        <img src={src} alt={alt} />
      </div>

      {caption && <p className="lightbox-cap">{caption}</p>}
    </div>
  );
}

/**
 * Wraps any render so it can be opened for inspection.
 *
 * A button rather than a click handler on the image, so it is reachable in the
 * tab order and announced as something you can activate. The hint is visible on
 * hover and focus, never colour-only.
 */
export function Zoomable({
  src,
  alt,
  caption,
  className,
  children,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`zoomable${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
        aria-label={`Enlarge: ${alt}`}
      >
        {children}
        <span className="zoomable-hint" aria-hidden="true">
          Enlarge
        </span>
      </button>
      {open && <Lightbox src={src} alt={alt} caption={caption} onClose={close} />}
    </>
  );
}
