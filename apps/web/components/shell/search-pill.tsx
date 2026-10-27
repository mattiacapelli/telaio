"use client";

import { openPalette } from "./command-palette";

/** Campo di ricerca della barra superiore: apre la palette ⌘K. */
export function SearchPill({ placeholder }: { placeholder: string }) {
  return (
    <button
      type="button"
      onClick={openPalette}
      className="glass pill"
      style={{
        flex: "1 1 260px",
        maxWidth: 440,
        color: "#6b675c",
        cursor: "text",
        textAlign: "left",
      }}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <span style={{ flex: 1, minWidth: 0, font: "400 15px var(--font-sans)" }}>{placeholder}</span>
      <kbd
        style={{
          fontSize: 12,
          border: "1px solid rgba(23,21,15,.16)",
          borderRadius: 6,
          padding: "3px 6px",
          color: "#6b675c",
          font: "inherit",
        }}
      >
        ⌘K
      </kbd>
    </button>
  );
}
