"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Read-aloud with the device's own voice (Web Speech API): free, no server,
// works offline. Quality depends on the device; we pick the most natural
// English voice it offers.

const RATE = 0.92; // a touch slower than normal, to suit reflective reading
const MAX_CHUNK = 180; // some browsers stop speaking after ~15s of one utterance

// Higher is better. Named "natural"/"neural"/"enhanced" voices sound far less robotic.
function scoreVoice(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 6;
  if (/premium|enhanced/.test(n)) s += 5;
  if (/google/.test(n)) s += 2;
  if (/samantha|daniel|karen|serena|moira|arthur|martha/.test(n)) s += 2;
  if (/^en[-_](gb|us|au|ie|in)/i.test(v.lang)) s += 1;
  if (v.localService) s += 1;
  return s;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
  if (!voices.length) return null;
  return voices.reduce((best, v) => (scoreVoice(v) > scoreVoice(best) ? v : best), voices[0]);
}

// Splits text at sentence ends (then commas, then spaces) into short pieces.
function chunk(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?;:]+[.!?;:]*["”’)]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  const push = (piece: string) => {
    if ((cur + piece).length <= MAX_CHUNK) {
      cur += piece;
      return;
    }
    if (cur.trim()) out.push(cur.trim());
    cur = "";
    if (piece.length <= MAX_CHUNK) {
      cur = piece;
      return;
    }
    // A very long sentence: break at commas, then at spaces.
    for (const part of piece.split(/(?<=,)\s+|\s+/)) {
      if ((cur + " " + part).trim().length > MAX_CHUNK && cur.trim()) {
        out.push(cur.trim());
        cur = part;
      } else {
        cur = `${cur} ${part}`.trim();
      }
    }
    cur += " ";
  };
  sentences.forEach(push);
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface SpeechOptions {
  onStart?: () => void; // e.g. lower the background music
  onEnd?: () => void; // and bring it back
}

export function useSpeech({ onStart, onEnd }: SpeechOptions = {}) {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const runRef = useRef(0); // ignores events from readings that were cancelled
  const hooks = useRef({ onStart, onEnd });
  hooks.current = { onStart, onEnd };

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    // Voices load asynchronously in some browsers; asking once wakes them up.
    window.speechSynthesis.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", onVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", onVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const finish = useCallback((run: number) => {
    if (run !== runRef.current) return;
    setSpeakingId(null);
    hooks.current.onEnd?.();
  }, []);

  const stop = useCallback(() => {
    if (!supported) return;
    const wasSpeaking = runRef.current > 0 && speakingId !== null;
    runRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    if (wasSpeaking) hooks.current.onEnd?.();
  }, [supported, speakingId]);

  // Reads the text, then who said it. Calling again on the same id stops it.
  const speak = useCallback(
    (id: string, text: string, by?: string | null) => {
      if (!supported) return;
      if (speakingId === id) {
        stop();
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const run = ++runRef.current;
      const voice = pickVoice();
      const pieces = [...chunk(text), ...(by ? [by] : [])];
      setSpeakingId(id);
      hooks.current.onStart?.();
      pieces.forEach((piece, i) => {
        const u = new SpeechSynthesisUtterance(piece);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        } else {
          u.lang = "en-US";
        }
        u.rate = RATE;
        u.pitch = 1;
        if (i === pieces.length - 1) {
          u.onend = () => finish(run);
        }
        u.onerror = (e) => {
          // "interrupted"/"canceled" happen when we stop on purpose.
          if (e.error !== "interrupted" && e.error !== "canceled") finish(run);
        };
        synth.speak(u);
      });
      // Safari sometimes starts paused after a cancel.
      if (synth.paused) synth.resume();
    },
    [supported, speakingId, stop, finish]
  );

  return { supported, speakingId, speak, stop };
}
