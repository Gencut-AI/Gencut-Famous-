import type { ReactNode } from 'react';

export function Field(props: { id: string; label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <p id={`${props.id}-error`} className="error-text">
          {props.error}
        </p>
      ) : props.hint ? (
        <p className="text-sm text-ink-soft">{props.hint}</p>
      ) : null}
    </div>
  );
}

export function FormStatus({ state }: { state: { status: string; message?: string } }) {
  if (state.status === 'error') return <p role="alert" className="error-text">{state.message}</p>;
  if (state.status === 'saved') return <p role="status" className="text-sm font-medium text-bay-deep">{state.message ?? 'Saved.'}</p>;
  return null;
}
