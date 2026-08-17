"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Speech for the whole room.
 *
 * The preference is global and persisted, because someone who needs the voice
 * needs it on every surface - not on one page. Text is always rendered as well;
 * speech is never the only channel.
 */
const KEY = "drape.voice";

export function useSpeech() {
  const [on, setOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const has = typeof window !== "undefined" && "speechSynthesis" in window;
    setAvailable(has);
    if (!has) return;
    setOn(window.localStorage.getItem(KEY) === "on");
    return () => window.speechSynthesis.cancel();
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEY, next ? "on" : "off");
      } catch {
        /* private mode - the preference just won't persist */
      }
      if (!next) window.speechSynthesis?.cancel();
      return next;
    });
  }, []);

  /** `force` speaks even when the toggle is off, for an explicit "read it" press. */
  const say = useCallback(
    (text: string, force = false) => {
      if (!available || (!on && !force)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [available, on],
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { on, toggle, say, stop, speaking, available };
}
