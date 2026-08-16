"use client";

import type { Member } from "@/lib/types";
import { Avatar } from "./Avatar";

export function MembersPanel({
  members,
  userId,
  memberPercent,
}: {
  members: Member[];
  userId: string;
  memberPercent: (userId: string) => number;
}) {
  return (
    <div>
      <h2 className="font-display mb-4 text-xl">Room Members ({members.length})</h2>

      <ul className="nx-glass flex flex-col gap-3 rounded-2xl p-4">
        {members.map((m) => {
          const pct = memberPercent(m.user_id);
          return (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[.02] p-3.5 transition hover:border-white/15"
            >
              <span className="flex items-center gap-3">
                <Avatar name={m.username} className="h-8 w-8 text-[11px]" />
                <span className="text-white">
                  {m.username}
                  {m.user_id === userId && <span className="ml-1 text-gray-500">(you)</span>}
                </span>
              </span>
              <span className="font-mono text-xs text-gray-500">{pct}% done</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
