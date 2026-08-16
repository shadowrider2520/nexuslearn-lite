"use client";

import { leaveRoom } from "../../actions";
import type { RoomTab } from "@/lib/types";

const TABS: { key: RoomTab; label: string }[] = [
  { key: "roadmap", label: "Roadmap" },
  { key: "chat", label: "Chat" },
  { key: "members", label: "Members" },
];

export function RoomNavbar({
  roomName,
  inviteCode,
  roomId,
  activeTab,
  onTabChange,
}: {
  roomName: string;
  inviteCode: string;
  roomId: string;
  activeTab: RoomTab;
  onTabChange: (tab: RoomTab) => void;
}) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="font-display truncate text-xl">{roomName}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] tracking-[.14em] text-gray-500">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
            CODE{" "}
            <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] tracking-normal text-purple-300">
              {inviteCode}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                activeTab === tab.key
                  ? "bg-white font-semibold text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <form action={leaveRoom.bind(null, roomId)}>
            <button className="ml-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition hover:border-red-400/40 hover:text-red-300">
              Exit
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
