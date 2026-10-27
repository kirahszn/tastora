"use client";
// A short list of entries: type and press Enter (or Add), or tap a suggestion. Each entry is a
// chip with its own Remove button. Text left in the box is added when focus leaves it.
import { useId, useRef, useState } from "react";
import styles from "./form.module.css";

interface Props {
  id: string;
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: readonly string[];
  max: number;
  maxLength: number;
  placeholder?: string;
  error?: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function ListInput({ id, label, hint, values, onChange, suggestions = [], max, maxLength, placeholder, error }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const full = values.length >= max;

  const add = (raw: string) => {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value || full || values.some((v) => same(v, value))) return false;
    onChange([...values, value]);
    return true;
  };
  const commit = () => {
    if (add(text) || values.some((v) => same(v, text))) setText("");
  };
  const removeAt = (i: number) => onChange(values.filter((_, j) => j !== i));
  // The chip's button disappears with it; keep keyboard focus in the field instead of losing it.
  const removeChip = (i: number) => {
    removeAt(i);
    // After the re-render: a full list's input is disabled until then.
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const toggle = (s: string) => {
    const i = values.findIndex((v) => same(v, s));
    if (i >= 0) removeAt(i);
    else add(s);
  };

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {values.length > 0 && (
        <ul className={styles.chips} aria-label={`${label}: added`}>
          {values.map((v, i) => (
            <li key={v} className={styles.chip}>
              <span>{v}</span>
              <button type="button" className={styles.chipRemove} onClick={() => removeChip(i)} aria-label={`Remove ${v}`}>
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.addRow}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          className={styles.input}
          value={text}
          maxLength={maxLength}
          placeholder={full ? `That's the most (${max})` : placeholder}
          disabled={full}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // add, don't submit the form
              commit();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={commit} disabled={full || !text.trim()}>
          Add<span className="sr-only"> to {label.toLowerCase()}</span>
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className={styles.suggestions} role="group" aria-label={`Suggestions for ${label.toLowerCase()}`}>
          {suggestions.map((s) => {
            const on = values.some((v) => same(v, s));
            return (
              <button
                key={s}
                type="button"
                className={styles.suggestion}
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(s)}
              >
                <span aria-hidden="true">{on ? "✓ " : "+ "}</span>
                {s}
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
