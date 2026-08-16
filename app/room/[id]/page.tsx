"use client";

import { Geist, Young_Serif } from "next/font/google";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  updateRoomName,
  leaveRoom,
  deleteRoadmap,
  deleteTasks,
} from "../../actions";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const youngSerif = Young_Serif({
  subsets: ["latin"],
  variable: "--font-young-serif",
  weight: "400",
});

type Step = {
  id: number;
  day: number;
  title: string;
  description: string;
  estimated_minutes: number;
};

type ProgressRow = {
  step_id: number;
  user_id: string;
  completed: boolean;
};

type TaskProgressRow = {
  step_id: number;
  task_id: number;
  user_id: string;
  completed: boolean;
};

type RoadmapMeta = {
  id: string;
  topic: string;
  created_at: string;
};

type TaskItem = {
  id: number;
  type: "task" | "project";
  title: string;
  description: string;
};

type ChatMessage = {
  id: string;
  username: string;
  content: string;
  is_ai: boolean;
  created_at: string;
};

const avatarColors = [
  "bg-gradient-to-br from-indigo-300 to-purple-400 text-black",
  "bg-gradient-to-br from-sky-300 to-cyan-400 text-black",
  "bg-gradient-to-br from-emerald-300 to-teal-400 text-black",
  "bg-gradient-to-br from-amber-300 to-orange-400 text-black",
  "bg-gradient-to-br from-pink-300 to-rose-400 text-black",
];

const initials = (name: string) => (name || "?").slice(0, 2).toUpperCase();

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [roomId, setRoomId] = useState("");

  const [room, setRoom] = useState<{
    name: string;
    invite_code: string;
    created_by: string;
  } | null>(null);

  const [members, setMembers] = useState<
    { user_id: string; username: string }[]
  >([]);

  const [userId, setUserId] = useState("");

  /*
   * ROADMAP
   */

  const [roadmapsList, setRoadmapsList] = useState<RoadmapMeta[]>([]);
  const [activeRoadmapId, setActiveRoadmapId] =
    useState<string | null>(null);

  const [steps, setSteps] = useState<Step[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);

  /*
   * TASKS
   */

  const [tasksByStep, setTasksByStep] = useState<
    Record<number, TaskItem[]>
  >({});

  const [taskProgress, setTaskProgress] = useState<
    TaskProgressRow[]
  >([]);

  const [taskLoadingStep, setTaskLoadingStep] =
    useState<number | null>(null);

  /*
   * CHAT
   */

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  /*
   * ROADMAP GENERATION
   */

  const [topic, setTopic] = useState("");
  const [minutesPerDay, setMinutesPerDay] = useState(30);
  const [detailLevel, setDetailLevel] = useState("detailed");

  const [formStep, setFormStep] = useState<
    "topic" | "prefs"
  >("topic");

  const [showNewRoadmapForm, setShowNewRoadmapForm] =
    useState(false);

  const [loading, setLoading] = useState(false);

  /*
   * ACTIVE TAB
   */

  const [activeTab, setActiveTab] = useState<
    "roadmap" | "chat" | "members"
  >("roadmap");

  const supabase = createClient();

  /*
   * GET ROOM ID
   */

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  /*
   * LOAD ROOM + MEMBERS
   */

  const loadRoomAndMembers = async () => {
    if (!roomId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setUserId(user.id);
    }

    const { data: roomData, error: roomError } =
      await supabase
        .from("rooms")
        .select("name, invite_code, created_by")
        .eq("id", roomId)
        .single();

    if (roomError) {
      console.error("ROOM LOAD ERROR:", roomError);
      return;
    }

    setRoom(roomData);

    const { data: memberRows, error: memberError } =
      await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId);

    if (memberError) {
      console.error("MEMBERS LOAD ERROR:", memberError);
      return;
    }

    if (!memberRows || memberRows.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = memberRows.map((m) => m.user_id);

    const { data: profileRows, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

    if (profileError) {
      console.error("PROFILE LOAD ERROR:", profileError);
    }

    setMembers(
      memberRows.map((m) => ({
        user_id: m.user_id,
        username:
          profileRows?.find(
            (p) => p.id === m.user_id
          )?.username ?? "Unknown",
      }))
    );
  };

  /*
   * LOAD ROADMAP LIST
   */

  const loadRoadmapsList = async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("roadmaps")
      .select("id, topic, created_at")
      .eq("room_id", roomId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("ROADMAP LIST ERROR:", error);
      return;
    }

    if (data) {
      setRoadmapsList(data);

      if (
        !activeRoadmapId &&
        data.length > 0
      ) {
        setActiveRoadmapId(data[0].id);
      }
    }
  };

  /*
   * LOAD ACTIVE ROADMAP
   */

  const loadActiveRoadmapData = async (
    roadmapId: string
  ) => {
    /*
     * ROADMAP STEPS
     */

    const { data: roadmapData, error: roadmapError } =
      await supabase
        .from("roadmaps")
        .select("steps")
        .eq("id", roadmapId)
        .single();

    if (roadmapError) {
      console.error(
        "ROADMAP DATA ERROR:",
        roadmapError
      );
    } else if (roadmapData) {
      setSteps(
        roadmapData.steps as Step[]
      );
    }

    /*
     * STEP PROGRESS
     */

    const {
      data: progressData,
      error: progressError,
    } = await supabase
      .from("progress")
      .select(
        "step_id, user_id, completed"
      )
      .eq("roadmap_id", roadmapId);

    if (progressError) {
      console.error(
        "PROGRESS LOAD ERROR:",
        progressError
      );
    } else {
      setProgress(
        (progressData ??
          []) as ProgressRow[]
      );
    }

    /*
     * TASKS
     */

    const {
      data: taskRows,
      error: taskError,
    } = await supabase
      .from("tasks")
      .select("step_id, items")
      .eq("roadmap_id", roadmapId);

    if (taskError) {
      console.error(
        "TASK LOAD ERROR:",
        taskError
      );
    }

    const map: Record<
      number,
      TaskItem[]
    > = {};

    (taskRows ?? []).forEach(
      (row: any) => {
        map[row.step_id] =
          row.items ?? [];
      }
    );

    setTasksByStep(map);

    /*
     * TASK PROGRESS
     */

    const {
      data: taskProgressData,
      error: taskProgressError,
    } = await supabase
      .from("task_progress")
      .select(
        "step_id, task_id, user_id, completed"
      )
      .eq("roadmap_id", roadmapId);

    if (taskProgressError) {
      console.error(
        "TASK PROGRESS LOAD ERROR:",
        taskProgressError
      );
    } else {
      setTaskProgress(
        (taskProgressData ??
          []) as TaskProgressRow[]
      );
    }
  };

  /*
   * LOAD CHAT MESSAGES
   */

  const loadMessages = async () => {
    if (!roomId) return;

    const {
      data,
      error,
    } = await supabase
      .from("messages")
      .select(
        "id, username, content, is_ai, created_at"
      )
      .eq("room_id", roomId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "MESSAGES LOAD ERROR:",
        error
      );
      return;
    }

    if (data) {
      setMessages(
        data as ChatMessage[]
      );
    }
  };

  /*
   * ROOM REALTIME
   */

  useEffect(() => {
    if (!roomId) return;

    loadRoomAndMembers();
    loadRoadmapsList();
    loadMessages();

    /*
     * MEMBERS REALTIME
     */

    const memberChannel = supabase
      .channel(`members-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadRoomAndMembers();
        }
      )
      .subscribe();

    /*
     * CHAT REALTIME
     */

    const msgChannel = supabase
      .channel(`messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        memberChannel
      );

      supabase.removeChannel(
        msgChannel
      );
    };
  }, [roomId]);

  /*
   * ACTIVE ROADMAP REALTIME
   */

  useEffect(() => {
    if (!activeRoadmapId) return;

    loadActiveRoadmapData(
      activeRoadmapId
    );

    /*
     * STEP PROGRESS REALTIME
     */

    const progressChannel = supabase
      .channel(
        `progress-${activeRoadmapId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "progress",
          filter: `roadmap_id=eq.${activeRoadmapId}`,
        },
        () => {
          loadActiveRoadmapData(
            activeRoadmapId
          );
        }
      )
      .subscribe();

    /*
     * TASK PROGRESS REALTIME
     */

    const taskProgressChannel =
      supabase
        .channel(
          `task-progress-${activeRoadmapId}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "task_progress",
            filter: `roadmap_id=eq.${activeRoadmapId}`,
          },
          () => {
            loadActiveRoadmapData(
              activeRoadmapId
            );
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        progressChannel
      );

      supabase.removeChannel(
        taskProgressChannel
      );
    };
  }, [activeRoadmapId]);

  /*
   * GENERATE ROADMAP
   */

  const generateRoadmap = async () => {
    if (!topic.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(
        "/api/roadmap",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            topic,
            roomId,
            minutesPerDay,
            detailLevel,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        console.error(
          "ROADMAP GENERATION ERROR:",
          data
        );
        return;
      }

      setShowNewRoadmapForm(false);
      setFormStep("topic");
      setTopic("");

      await loadRoadmapsList();

      if (data.id) {
        setActiveRoadmapId(
          data.id
        );
      }
    } catch (error) {
      console.error(
        "ROADMAP REQUEST ERROR:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * DELETE ROADMAP
   */

  const handleDeleteRoadmap = async (
    roadmapId: string
  ) => {
    try {
      await deleteRoadmap(
        roadmapId
      );

      if (
        activeRoadmapId ===
        roadmapId
      ) {
        setActiveRoadmapId(null);
        setSteps([]);
        setProgress([]);
        setTaskProgress([]);
        setTasksByStep({});
      }

      await loadRoadmapsList();
    } catch (error) {
      console.error(
        "DELETE ROADMAP ERROR:",
        error
      );
    }
  };

  /*
   * TOGGLE STEP
   */

  const toggleStep = async (
    stepId: number,
    currentlyDone: boolean
  ) => {
    if (
      !activeRoadmapId ||
      !userId
    ) {
      return;
    }

    const newCompleted =
      !currentlyDone;

    const {
      error,
    } = await supabase
      .from("progress")
      .upsert(
        {
          room_id: roomId,
          roadmap_id:
            activeRoadmapId,
          step_id: stepId,
          user_id: userId,
          completed:
            newCompleted,
          completed_at:
            newCompleted
              ? new Date().toISOString()
              : null,
        },
        {
          onConflict:
            "roadmap_id,step_id,user_id",
        }
      );

    if (error) {
      console.error(
        "STEP PROGRESS ERROR:",
        error
      );
      return;
    }

    /*
     * Update UI immediately
     */

    setProgress((prev) => {
      const existing =
        prev.find(
          (p) =>
            p.step_id ===
              stepId &&
            p.user_id ===
              userId
        );

      if (existing) {
        return prev.map((p) =>
          p.step_id ===
              stepId &&
          p.user_id ===
              userId
            ? {
                ...p,
                completed:
                  newCompleted,
              }
            : p
        );
      }

      return [
        ...prev,
        {
          step_id: stepId,
          user_id: userId,
          completed:
            newCompleted,
        },
      ];
    });
  };

  /*
   * TOGGLE TASK
   */

  const toggleTask = async (
    stepId: number,
    taskId: number,
    currentlyDone: boolean
  ) => {
    if (
      !activeRoadmapId ||
      !userId
    ) {
      return;
    }

    const newCompleted =
      !currentlyDone;

    const {
      error,
    } = await supabase
      .from("task_progress")
      .upsert(
        {
          room_id: roomId,
          roadmap_id:
            activeRoadmapId,
          step_id: stepId,
          task_id: taskId,
          user_id: userId,
          completed:
            newCompleted,
          completed_at:
            newCompleted
              ? new Date().toISOString()
              : null,
        },
        {
          onConflict:
            "roadmap_id,step_id,task_id,user_id",
        }
      );

    if (error) {
      console.error(
        "TASK PROGRESS ERROR:",
        error
      );
      return;
    }

    /*
     * Update UI immediately
     */

    setTaskProgress((prev) => {
      const existing =
        prev.find(
          (p) =>
            p.step_id ===
              stepId &&
            p.task_id ===
              taskId &&
            p.user_id ===
              userId
        );

      if (existing) {
        return prev.map((p) =>
          p.step_id ===
              stepId &&
          p.task_id ===
              taskId &&
          p.user_id ===
              userId
            ? {
                ...p,
                completed:
                  newCompleted,
              }
            : p
        );
      }

      return [
        ...prev,
        {
          step_id: stepId,
          task_id: taskId,
          user_id: userId,
          completed:
            newCompleted,
        },
      ];
    });
  };

  /*
   * GENERATE TASKS
   */

  const generateTasksForStep = async (
    step: Step
  ) => {
    if (!activeRoadmapId) {
      return;
    }

    setTaskLoadingStep(
      step.id
    );

    try {
      const res = await fetch(
        "/api/tasks",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            roomId,
            roadmapId:
              activeRoadmapId,
            stepId: step.id,
            stepTitle:
              step.title,
            stepDescription:
              step.description,
          }),
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        console.error(
          "TASK GENERATION ERROR:",
          data
        );
        return;
      }

      setTasksByStep(
        (prev) => ({
          ...prev,
          [step.id]:
            data.items ?? [],
        })
      );

      /*
       * Reload task progress
       * after generating tasks.
       */

      await loadActiveRoadmapData(
        activeRoadmapId
      );
    } catch (error) {
      console.error(
        "TASK REQUEST ERROR:",
        error
      );
    } finally {
      setTaskLoadingStep(
        null
      );
    }
  };

  /*
   * DELETE TASKS
   */

  const handleDeleteTasks = async (
    stepId: number
  ) => {
    if (!activeRoadmapId) {
      return;
    }

    try {
      await deleteTasks(
        activeRoadmapId,
        stepId
      );

      setTasksByStep(
        (prev) => {
          const copy = {
            ...prev,
          };

          delete copy[
            stepId
          ];

          return copy;
        }
      );

      /*
       * Remove old task progress
       * from local state.
       */

      setTaskProgress(
        (prev) =>
          prev.filter(
            (p) =>
              p.step_id !==
              stepId
          )
      );
    } catch (error) {
      console.error(
        "DELETE TASKS ERROR:",
        error
      );
    }
  };

  /*
   * SEND CHAT MESSAGE
   */

  const sendMessage = async () => {
    if (
      !chatInput.trim() ||
      chatLoading
    ) {
      return;
    }

    console.log(
      "SEND MESSAGE",
      new Date().toISOString(),
      Math.random()
    );

    setChatLoading(true);

    try {
      const res = await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            roomId,
            content:
              chatInput.trim(),
          }),
        }
      );

      const result =
        await res.json();

      if (!res.ok) {
        console.error(
          "CHAT ERROR:",
          result
        );
        return;
      }

      setChatInput("");

      /*
       * Realtime will normally
       * update the messages.
       *
       * This also ensures the
       * current sender sees the
       * latest state immediately.
       */

      await loadMessages();
    } catch (error) {
      console.error(
        "CHAT REQUEST FAILED:",
        error
      );
    } finally {
      setChatLoading(false);
    }
  };

  /*
   * COMPLETED USERS
   */

  const getCompletedUsers = (
    stepId: number
  ) =>
    progress
      .filter(
        (p) =>
          p.step_id ===
            stepId &&
          p.completed
      )
      .map(
        (p) =>
          members.find(
            (m) =>
              m.user_id ===
              p.user_id
          )?.username ??
          "?"
      );

  /*
   * MEMBER PROGRESS
   */

  const getMemberPercent = (
    memberId: string
  ) => {
    if (
      steps.length === 0
    ) {
      return 0;
    }

    const done =
      progress.filter(
        (p) =>
          p.user_id ===
            memberId &&
          p.completed
      ).length;

    return Math.round(
      (done /
        steps.length) *
        100
    );
  };

  /*
   * LOADING
   */

  if (!room) {
    return (
      <div className="nx-bg flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="grad-btn grid h-14 w-14 animate-pulse place-items-center rounded-2xl text-2xl font-black">N</div>
          <p className="font-display text-lg">Loading your room…</p>
        </div>
      </div>
    );
  }

  const isHost =
    userId ===
    room.created_by;

  const dayNumbers = [
    ...new Set(
      steps.map(
        (s) => s.day
      )
    ),
  ];

  return (
    <div className={`${geist.variable} ${youngSerif.variable} nx-bg flex h-screen flex-col text-white`}>
      {/* ================================================= */}
      {/* NAVBAR */}
      {/* ================================================= */}

      <div className="shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="font-display truncate text-xl">{room.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] tracking-[.14em] text-gray-500">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
              CODE{" "}
              <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] tracking-normal text-purple-300">
                {room.invite_code}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("roadmap")}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                activeTab === "roadmap"
                  ? "bg-white font-semibold text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Roadmap
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                activeTab === "chat"
                  ? "bg-white font-semibold text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Chat
            </button>

            <button
              onClick={() => setActiveTab("members")}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                activeTab === "members"
                  ? "bg-white font-semibold text-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Members
            </button>

            <form action={leaveRoom.bind(null, roomId)}>
              <button className="ml-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition hover:border-red-400/40 hover:text-red-300">
                Exit
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* MAIN CONTENT */}
      {/* ================================================= */}

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-10">
        {/* ================================================= */}
        {/* ROADMAP */}
        {/* ================================================= */}

        {activeTab === "roadmap" && (
          <div>
            {/* RENAME ROOM */}

            {isHost && (
              <form
                action={updateRoomName.bind(null, roomId)}
                className="nx-glass nx-fade mb-8 flex gap-2 rounded-2xl p-4"
              >
                <input
                  name="name"
                  placeholder="Rename room"
                  className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
                />
                <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200">
                  Rename
                </button>
              </form>
            )}

            {/* PROGRESS */}

            {steps.length > 0 && (
              <div className="nx-fade nx-fade-1 mb-8">
                <h2 className="font-display mb-4 text-xl">Progress</h2>
                <div className="flex flex-col gap-4">
                  {members.map((m, i) => {
                    const pct = getMemberPercent(m.user_id);

                    return (
                      <div key={m.user_id}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2.5">
                            <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${avatarColors[i % avatarColors.length]}`}>
                              {initials(m.username)}
                            </span>
                            <span className="text-white">
                              {m.username}
                              {m.user_id === userId && <span className="ml-1 text-gray-500">(you)</span>}
                            </span>
                          </span>
                          <span className="font-mono text-xs text-gray-400">{pct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-white/5">
                          <div
                            className="grad-bar h-2 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {pct === 100 && <p className="mt-2 text-xs text-gray-500">Roadmap completed 🎉</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ROADMAP LIST */}

            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl">Roadmaps</h2>
                <button
                  onClick={() => setShowNewRoadmapForm(true)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition hover:border-purple-400/50 hover:text-purple-300"
                >
                  + New roadmap
                </button>
              </div>

              {roadmapsList.length > 0 && (
                <div className="mb-5 flex flex-wrap gap-2">
                  {roadmapsList.map((r) => (
                    <div
                      key={r.id}
                      className={`group flex items-center gap-1 rounded-xl border px-3 py-2 text-sm transition ${
                        activeRoadmapId === r.id
                          ? "border-white bg-white font-semibold text-black"
                          : "border-white/10 bg-white/[.03] text-gray-300 hover:border-white/30"
                      }`}
                    >
                      <button onClick={() => setActiveRoadmapId(r.id)}>{r.topic}</button>
                      <button
                        onClick={() => handleDeleteRoadmap(r.id)}
                        className="ml-1 opacity-40 transition hover:opacity-100 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* NEW ROADMAP FORM */}

              {showNewRoadmapForm &&
                (formStep === "topic" ? (
                  <div className="mb-5 flex gap-2">
                    <input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Paste a topic or notes…"
                      className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
                    />
                    <button
                      onClick={() => topic.trim() && setFormStep("prefs")}
                      className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gray-200"
                    >
                      Next
                    </button>
                  </div>
                ) : (
                  <div className="nx-glass nx-fade mb-5 flex flex-col gap-5 rounded-2xl p-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Minutes per day?</label>
                      <input
                        type="number"
                        value={minutesPerDay}
                        onChange={(e) => setMinutesPerDay(Number(e.target.value))}
                        className="w-32 rounded-xl border border-white/10 bg-black/40 p-2 text-sm text-white outline-none transition focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white">Complexity?</label>
                      <div className="flex flex-wrap gap-2">
                        {["quick", "detailed", "thorough"].map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => setDetailLevel(lvl)}
                            className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                              detailLevel === lvl
                                ? "grad-btn border-transparent font-semibold"
                                : "border-white/10 bg-white/[.03] text-gray-400 hover:border-white/30 hover:text-white"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFormStep("topic")}
                        className="text-sm text-gray-400 underline transition hover:text-white"
                      >
                        Back
                      </button>
                      <button
                        onClick={generateRoadmap}
                        disabled={loading}
                        className="grad-btn ml-auto rounded-xl px-5 py-2 text-sm font-bold transition hover:opacity-90 disabled:opacity-40"
                      >
                        {loading ? "Generating…" : "Generate"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* ROADMAP STEPS */}

            {activeRoadmapId && steps.length > 0 && (
              <div className="flex flex-col gap-8">
                {dayNumbers.map((dayNum) => (
                  <div key={dayNum}>
                    <h3 className="mb-3 flex items-center gap-3 font-display text-lg">
                      Day {dayNum}
                      <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                    </h3>

                    <ul className="flex flex-col gap-3">
                      {steps
                        .filter((s) => s.day === dayNum)
                        .map((step) => {
                          const myDone = progress.some(
                            (p) => p.step_id === step.id && p.user_id === userId && p.completed
                          );

                          const completedByUsernames = getCompletedUsers(step.id);
                          const stepTasks = tasksByStep[step.id];

                          return (
                            <li
                              key={step.id}
                              className="nx-glass group rounded-2xl p-5 transition hover:border-white/20"
                            >
                              <div className="flex items-start gap-3.5">
                                {/* STEP CHECKBOX */}

                                <input
                                  type="checkbox"
                                  checked={myDone}
                                  onChange={() => toggleStep(step.id, myDone)}
                                  className="mt-1 h-4 w-4 cursor-pointer accent-purple-400"
                                />

                                <div className="flex-1">
                                  {/* STEP TITLE */}

                                  <p
                                    className={
                                      myDone
                                        ? "font-semibold text-gray-500 line-through"
                                        : "font-semibold text-white"
                                    }
                                  >
                                    {step.title}
                                  </p>

                                  {/* DESCRIPTION */}

                                  <p className="mt-1 text-sm text-gray-300">{step.description}</p>

                                  {/* TIME */}

                                  <p className="mt-1 text-xs text-gray-500">⏱ {step.estimated_minutes} min</p>

                                  {/* COMPLETED USERS */}

                                  {completedByUsernames.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                      <span className="text-xs text-gray-500">Completed by:</span>
                                      {completedByUsernames.map((u, idx) => (
                                        <span
                                          key={`${u}-${idx}`}
                                          className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300"
                                        >
                                          {u}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* TASKS */}

                                  <div className="mt-4 border-t border-white/10 pt-3">
                                    {!stepTasks ? (
                                      <button
                                        onClick={() => generateTasksForStep(step)}
                                        disabled={taskLoadingStep === step.id}
                                        className="text-xs text-gray-400 underline underline-offset-2 transition hover:text-purple-300"
                                      >
                                        {taskLoadingStep === step.id
                                          ? "Generating…"
                                          : "Generate tasks & mini-project"}
                                      </button>
                                    ) : (
                                      <div>
                                        {/* TASK HEADER */}

                                        <div className="mb-3 flex items-center justify-between">
                                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                            Tasks & Projects
                                          </p>
                                          <div className="flex gap-3">
                                            <button
                                              onClick={() => generateTasksForStep(step)}
                                              className="text-xs text-gray-400 underline transition hover:text-purple-300"
                                            >
                                              Regenerate
                                            </button>
                                            <button
                                              onClick={() => handleDeleteTasks(step.id)}
                                              className="text-xs text-red-400 underline transition hover:text-red-300"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>

                                        {/* TASK LIST */}

                                        <ul className="flex flex-col gap-2">
                                          {stepTasks.map((t) => {
                                            const taskDone = taskProgress.some(
                                              (p) =>
                                                p.step_id === step.id &&
                                                p.task_id === t.id &&
                                                p.user_id === userId &&
                                                p.completed
                                            );

                                            return (
                                              <li
                                                key={t.id}
                                                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[.03] p-3 text-xs text-white transition hover:border-white/15"
                                              >
                                                {/* TASK CHECKBOX */}

                                                <input
                                                  type="checkbox"
                                                  checked={taskDone}
                                                  onChange={() => toggleTask(step.id, t.id, taskDone)}
                                                  className="mt-0.5 h-4 w-4 cursor-pointer accent-purple-400"
                                                />

                                                <div className="flex-1">
                                                  <span
                                                    className={
                                                      t.type === "project"
                                                        ? "font-semibold text-purple-400"
                                                        : "font-semibold text-blue-400"
                                                    }
                                                  >
                                                    [{t.type === "project" ? "Project" : "Task"}]
                                                  </span>{" "}

                                                  <span
                                                    className={
                                                      taskDone ? "text-gray-500 line-through" : "text-white"
                                                    }
                                                  >
                                                    {t.title}
                                                  </span>

                                                  {t.description && (
                                                    <p
                                                      className={
                                                        taskDone
                                                          ? "mt-1 text-gray-600 line-through"
                                                          : "mt-1 text-gray-400"
                                                      }
                                                    >
                                                      {t.description}
                                                    </p>
                                                  )}
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================= */}
        {/* CHAT */}
        {/* ================================================= */}

        {activeTab === "chat" && (
          <div className="flex h-full flex-col">
            {/* MESSAGE AREA */}

            <div className="nx-glass mb-4 flex-1 overflow-auto rounded-2xl p-5">
              <div className="flex flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="pulse-dot mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-purple-400/30 bg-purple-500/10 text-2xl">
                      ✦
                    </div>
                    <p className="font-display text-xl">Start a conversation</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Ask the AI tutor something or start discussing with your group.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.is_ai ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          m.is_ai
                            ? "border border-purple-400/20 bg-purple-500/10"
                            : "bg-white text-black shadow-lg"
                        }`}
                      >
                        <div
                          className={`mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide ${
                            m.is_ai ? "text-purple-300" : "text-black"
                          }`}
                        >
                          {m.is_ai && <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />}
                          {m.is_ai ? "AI Tutor" : m.username}
                        </div>

                        <p
                          className={`whitespace-pre-wrap text-sm leading-6 ${
                            m.is_ai ? "text-gray-200" : "text-black"
                          }`}
                        >
                          {m.content}
                        </p>

                        <p className="mt-2 text-[10px] text-gray-500">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CHAT INPUT */}

            <div className="flex items-center gap-3 pb-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask the tutor or chat with your group…"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
              />

              <button
                onClick={sendMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="grad-btn rounded-xl px-5 py-3 text-sm font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {chatLoading ? "Thinking…" : "Send"}
              </button>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* MEMBERS */}
        {/* ================================================= */}

        {activeTab === "members" && (
          <div>
            <h2 className="font-display mb-4 text-xl">Room Members ({members.length})</h2>

            <ul className="nx-glass flex flex-col gap-3 rounded-2xl p-4">
              {members.map((m, i) => {
                const pct = getMemberPercent(m.user_id);
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[.02] p-3.5 transition hover:border-white/15"
                  >
                    <span className="flex items-center gap-3">
                      <span className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold ${avatarColors[i % avatarColors.length]}`}>
                        {initials(m.username)}
                      </span>
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
        )}
      </div>
    </div>
  );
}
