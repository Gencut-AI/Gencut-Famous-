'use client';

import { useState } from 'react';

/**
 * Copies to the clipboard. Where the browser refuses (some in-app browsers),
 * it selects the link in the field next to it so it can be copied by hand.
 */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'manual'>('idle');
  const fallback = (button: HTMLButtonElement) => {
    const field = button.parentElement?.querySelector('input');
    if (field) {
      field.focus();
      field.select();
    }
    setState('manual');
  };
  return (
    <button
      type="button"
      className="btn-quiet shrink-0"
      onClick={(e) => {
        const button = e.currentTarget;
        if (!navigator.clipboard?.writeText) return fallback(button);
        navigator.clipboard.writeText(text).then(() => setState('done'), () => fallback(button));
      }}
    >
      {state === 'done' ? 'Copied' : state === 'manual' ? 'Selected: copy it' : label}
    </button>
  );
}
