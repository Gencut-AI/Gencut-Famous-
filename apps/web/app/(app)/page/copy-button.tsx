'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-quiet shrink-0" onClick={() => navigator.clipboard.writeText(text).then(() => setDone(true))}>
      {done ? 'Copied' : label}
    </button>
  );
}
