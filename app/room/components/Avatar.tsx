"use client";

const avatarColors = [
  "bg-gradient-to-br from-indigo-300 to-purple-400 text-black",
  "bg-gradient-to-br from-sky-300 to-cyan-400 text-black",
  "bg-gradient-to-br from-emerald-300 to-teal-400 text-black",
  "bg-gradient-to-br from-amber-300 to-orange-400 text-black",
  "bg-gradient-to-br from-pink-300 to-rose-400 text-black",
];

export const initials = (name: string) => (name || "?").slice(0, 2).toUpperCase();

/** Stable hash so each member keeps the same color as others join/leave. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const color = avatarColors[hashString(name) % avatarColors.length];
  return (
    <span
      className={`grid place-items-center rounded-full font-bold ${color} ${className ?? ""}`}
    >
      {initials(name)}
    </span>
  );
}
