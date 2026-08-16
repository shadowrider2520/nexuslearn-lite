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
      <div
        className={`${youngSerif.variable} min-h-screen bg-black text-white flex items-center justify-center`}
        style={{
          fontFamily:
            "var(--font-young-serif)",
        }}
      >
        Loading...
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
    <div
      className={`${geist.variable} ${youngSerif.variable} flex flex-col h-screen bg-black text-white`}
      style={{
        fontFamily:
          "var(--font-young-serif)",
      }}
    >
      {/* ================================================= */}
      {/* NAVBAR */}
      {/* ================================================= */}

      <div className="bg-black text-white p-4 flex justify-between items-center border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-xl font-bold">
            {room.name}
          </h1>

          <p className="text-xs text-gray-500">
            Code:{" "}
            {room.invite_code}
          </p>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() =>
              setActiveTab(
                "roadmap"
              )
            }
            className={`px-3 py-1 rounded text-sm transition ${
              activeTab ===
              "roadmap"
                ? "bg-white text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Roadmap
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "chat"
              )
            }
            className={`px-3 py-1 rounded text-sm transition ${
              activeTab ===
              "chat"
                ? "bg-white text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Chat
          </button>

          <button
            onClick={() =>
              setActiveTab(
                "members"
              )
            }
            className={`px-3 py-1 rounded text-sm transition ${
              activeTab ===
              "members"
                ? "bg-white text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Members
          </button>
        </div>

        <form
          action={leaveRoom.bind(
            null,
            roomId
          )}
        >
          <button className="text-sm text-gray-400 hover:text-white transition">
            Exit
          </button>
        </form>
      </div>

      {/* ================================================= */}
      {/* MAIN CONTENT */}
      {/* ================================================= */}

      <div
        className="
          flex-1
          overflow-auto
          bg-black
          text-white
          p-10
          max-w-4xl
          mx-auto
          w-full
        "
      >
        {/* ================================================= */}
        {/* ROADMAP */}
        {/* ================================================= */}

        {activeTab ===
          "roadmap" && (
          <div>
            {/* RENAME ROOM */}

            {isHost && (
              <form
                action={updateRoomName.bind(
                  null,
                  roomId
                )}
                className="flex gap-2 mb-8"
              >
                <input
                  name="name"
                  placeholder="Rename room"
                  className="
                    flex-1
                    rounded-lg
                    border border-white/10
                    bg-[#111111]
                    text-white
                    placeholder:text-gray-600
                    px-4 py-2
                    outline-none
                    focus:border-white/30
                  "
                />

                <button className="bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">
                  Rename
                </button>
              </form>
            )}

            {/* PROGRESS */}

            {steps.length >
              0 && (
              <div className="mb-8">
                <h2 className="font-bold text-white text-lg mb-4">
                  Progress
                </h2>

                <div className="flex flex-col gap-4">
                  {members.map(
                    (m) => {
                      const pct =
                        getMemberPercent(
                          m.user_id
                        );

                      return (
                        <div
                          key={
                            m.user_id
                          }
                        >
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-white">
                              {
                                m.username
                              }

                              {m.user_id ===
                                userId &&
                                " (you)"}
                            </span>

                            <span className="text-gray-400">
                              {pct}%
                            </span>
                          </div>

                          <div className="w-full bg-[#1a1a1a] border border-white/5 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-white h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${pct}%`,
                              }}
                            />
                          </div>

                          {pct ===
                            100 && (
                            <p className="text-gray-400 text-xs mt-2">
                              Roadmap
                              completed
                            </p>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* ROADMAP LIST */}

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-white text-lg">
                  Roadmaps
                </h2>

                <button
                  onClick={() =>
                    setShowNewRoadmapForm(
                      true
                    )
                  }
                  className="text-sm text-gray-400 hover:text-white underline transition"
                >
                  + New
                </button>
              </div>

              {roadmapsList.length >
                0 && (
                <div className="flex gap-2 flex-wrap mb-5">
                  {roadmapsList.map(
                    (r) => (
                      <div
                        key={
                          r.id
                        }
                        className={`
                          flex
                          items-center
                          gap-1
                          border
                          rounded-lg
                          px-3
                          py-2
                          text-sm
                          transition
                          ${
                            activeRoadmapId ===
                            r.id
                              ? "bg-white text-black border-white"
                              : "bg-[#111111] text-gray-300 border-white/10 hover:border-white/30"
                          }
                        `}
                      >
                        <button
                          onClick={() =>
                            setActiveRoadmapId(
                              r.id
                            )
                          }
                        >
                          {
                            r.topic
                          }
                        </button>

                        <button
                          onClick={() =>
                            handleDeleteRoadmap(
                              r.id
                            )
                          }
                          className="ml-1 opacity-50 hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* NEW ROADMAP FORM */}

              {showNewRoadmapForm &&
                (formStep ===
                "topic" ? (
                  <div className="flex gap-2 mb-5">
                    <input
                      value={
                        topic
                      }
                      onChange={(
                        e
                      ) =>
                        setTopic(
                          e
                            .target
                            .value
                        )
                      }
                      placeholder="Paste a topic or notes..."
                      className="
                        flex-1
                        rounded-lg
                        border border-white/10
                        bg-[#111111]
                        text-white
                        placeholder:text-gray-600
                        px-4 py-2
                        outline-none
                        focus:border-white/30
                      "
                    />

                    <button
                      onClick={() =>
                        topic.trim() &&
                        setFormStep(
                          "prefs"
                        )
                      }
                      className="bg-white text-black px-4 py-2 rounded-lg font-semibold"
                    >
                      Next
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5 border border-white/10 bg-[#0d0d0d] p-5 rounded-xl mb-5">
                    <div>
                      <label className="text-sm font-semibold block mb-2 text-white">
                        Minutes per day?
                      </label>

                      <input
                        type="number"
                        value={
                          minutesPerDay
                        }
                        onChange={(
                          e
                        ) =>
                          setMinutesPerDay(
                            Number(
                              e
                                .target
                                .value
                            )
                          )
                        }
                        className="
                          border border-white/10
                          bg-[#111111]
                          text-white
                          p-2
                          rounded-lg
                          w-32
                          outline-none
                        "
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold block mb-2 text-white">
                        Complexity?
                      </label>

                      <div className="flex gap-2">
                        {[
                          "quick",
                          "detailed",
                          "thorough",
                        ].map(
                          (
                            lvl
                          ) => (
                            <button
                              key={
                                lvl
                              }
                              onClick={() =>
                                setDetailLevel(
                                  lvl
                                )
                              }
                              className={`
                                px-3
                                py-1
                                rounded-lg
                                text-sm
                                border
                                transition
                                ${
                                  detailLevel ===
                                  lvl
                                    ? "bg-white text-black border-white"
                                    : "bg-[#111111] text-gray-400 border-white/10"
                                }
                              `}
                            >
                              {
                                lvl
                              }
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setFormStep(
                            "topic"
                          )
                        }
                        className="text-sm text-gray-400 hover:text-white underline"
                      >
                        Back
                      </button>

                      <button
                        onClick={
                          generateRoadmap
                        }
                        disabled={
                          loading
                        }
                        className="
                          bg-white
                          text-black
                          px-4
                          py-2
                          rounded-lg
                          font-semibold
                          ml-auto
                          disabled:opacity-40
                        "
                      >
                        {loading
                          ? "Generating..."
                          : "Generate"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* ROADMAP STEPS */}

            {activeRoadmapId &&
              steps.length >
                0 && (
                <div className="flex flex-col gap-8">
                  {dayNumbers.map(
                    (dayNum) => (
                      <div
                        key={
                          dayNum
                        }
                      >
                        <h3 className="text-sm font-bold text-white mb-3">
                          Day{" "}
                          {dayNum}
                        </h3>

                        <ul className="flex flex-col gap-4">
                          {steps
                            .filter(
                              (
                                s
                              ) =>
                                s.day ===
                                dayNum
                            )
                            .map(
                              (
                                step
                              ) => {
                                const myDone =
                                  progress.some(
                                    (
                                      p
                                    ) =>
                                      p.step_id ===
                                        step.id &&
                                      p.user_id ===
                                        userId &&
                                      p.completed
                                  );

                                const completedByUsernames =
                                  getCompletedUsers(
                                    step.id
                                  );

                                const stepTasks =
                                  tasksByStep[
                                    step.id
                                  ];

                                return (
                                  <li
                                    key={
                                      step.id
                                    }
                                    className="
                                      border
                                      border-white/10
                                      bg-[#0d0d0d]
                                      p-4
                                      rounded-xl
                                    "
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* STEP CHECKBOX */}

                                      <input
                                        type="checkbox"
                                        checked={
                                          myDone
                                        }
                                        onChange={() =>
                                          toggleStep(
                                            step.id,
                                            myDone
                                          )
                                        }
                                        className="
                                          mt-1
                                          h-4
                                          w-4
                                          accent-white
                                          cursor-pointer
                                        "
                                      />

                                      <div className="flex-1">
                                        {/* STEP TITLE */}

                                        <p
                                          className={
                                            myDone
                                              ? "line-through text-gray-500 font-semibold"
                                              : "text-white font-semibold"
                                          }
                                        >
                                          {
                                            step.title
                                          }
                                        </p>

                                        {/* DESCRIPTION */}

                                        <p className="text-sm text-gray-300 mt-1">
                                          {
                                            step.description
                                          }
                                        </p>

                                        {/* TIME */}

                                        <p className="text-xs text-gray-500 mt-1">
                                          {
                                            step.estimated_minutes
                                          }{" "}
                                          min
                                        </p>

                                        {/* COMPLETED USERS */}

                                        {completedByUsernames.length >
                                          0 && (
                                          <p className="text-xs text-gray-400 mt-2">
                                            Completed
                                            by:{" "}
                                            {completedByUsernames.join(
                                              ", "
                                            )}
                                          </p>
                                        )}

                                        {/* TASKS */}

                                        <div className="mt-4 border-t border-white/10 pt-3">
                                          {!stepTasks ? (
                                            <button
                                              onClick={() =>
                                                generateTasksForStep(
                                                  step
                                                )
                                              }
                                              disabled={
                                                taskLoadingStep ===
                                                step.id
                                              }
                                              className="
                                                text-xs
                                                underline
                                                text-gray-400
                                                hover:text-white
                                              "
                                            >
                                              {taskLoadingStep ===
                                              step.id
                                                ? "Generating..."
                                                : "Generate tasks & mini-project"}
                                            </button>
                                          ) : (
                                            <div>
                                              {/* TASK HEADER */}

                                              <div className="flex justify-between items-center mb-3">
                                                <p className="text-xs font-semibold text-white">
                                                  Tasks
                                                  &
                                                  Projects
                                                </p>

                                                <div className="flex gap-3">
                                                  <button
                                                    onClick={() =>
                                                      generateTasksForStep(
                                                        step
                                                      )
                                                    }
                                                    className="text-xs text-gray-400 hover:text-white underline"
                                                  >
                                                    Regenerate
                                                  </button>

                                                  <button
                                                    onClick={() =>
                                                      handleDeleteTasks(
                                                        step.id
                                                      )
                                                    }
                                                    className="text-xs text-red-400 hover:text-red-300 underline"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </div>

                                              {/* TASK LIST */}

                                              <ul className="flex flex-col gap-2">
                                                {stepTasks.map(
                                                  (
                                                    t
                                                  ) => {
                                                    const taskDone =
                                                      taskProgress.some(
                                                        (
                                                          p
                                                        ) =>
                                                          p.step_id ===
                                                            step.id &&
                                                          p.task_id ===
                                                            t.id &&
                                                          p.user_id ===
                                                            userId &&
                                                          p.completed
                                                      );

                                                    return (
                                                      <li
                                                        key={
                                                          t.id
                                                        }
                                                        className="
                                                          text-xs
                                                          bg-[#11131f]
                                                          border
                                                          border-white/5
                                                          text-white
                                                          p-3
                                                          rounded-lg
                                                          flex
                                                          items-start
                                                          gap-3
                                                        "
                                                      >
                                                        {/* TASK CHECKBOX */}

                                                        <input
                                                          type="checkbox"
                                                          checked={
                                                            taskDone
                                                          }
                                                          onChange={() =>
                                                            toggleTask(
                                                              step.id,
                                                              t.id,
                                                              taskDone
                                                            )
                                                          }
                                                          className="
                                                            mt-0.5
                                                            h-4
                                                            w-4
                                                            accent-white
                                                            cursor-pointer
                                                          "
                                                        />

                                                        <div className="flex-1">
                                                          <span
                                                            className={
                                                              t.type ===
                                                              "project"
                                                                ? "text-purple-400 font-semibold"
                                                                : "text-blue-400 font-semibold"
                                                            }
                                                          >
                                                            [
                                                            {t.type ===
                                                            "project"
                                                              ? "Project"
                                                              : "Task"}
                                                            ]
                                                          </span>{" "}

                                                          <span
                                                            className={
                                                              taskDone
                                                                ? "line-through text-gray-500"
                                                                : "text-white"
                                                            }
                                                          >
                                                            {
                                                              t.title
                                                            }
                                                          </span>

                                                          {t.description && (
                                                            <p
                                                              className={
                                                                taskDone
                                                                  ? "mt-1 text-gray-600 line-through"
                                                                  : "mt-1 text-gray-400"
                                                              }
                                                            >
                                                              {
                                                                t.description
                                                              }
                                                            </p>
                                                          )}
                                                        </div>
                                                      </li>
                                                    );
                                                  }
                                                )}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                );
                              }
                            )}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              )}
          </div>
        )}

        {/* ================================================= */}
        {/* CHAT */}
        {/* ================================================= */}

        {activeTab ===
          "chat" && (
          <div
            className="flex flex-col h-full bg-black text-white"
            style={{
              fontFamily:
                "var(--font-young-serif)",
            }}
          >
            {/* MESSAGE AREA */}

            <div className="flex-1 overflow-auto mb-4 rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
              <div className="flex flex-col gap-4">
                {messages.length ===
                0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-white text-lg font-semibold">
                      Start a
                      conversation
                    </p>

                    <p className="text-gray-500 text-sm mt-1">
                      Ask the AI
                      tutor
                      something or
                      start
                      discussing
                      with your
                      group.
                    </p>
                  </div>
                ) : (
                  messages.map(
                    (m) => (
                      <div
                        key={
                          m.id
                        }
                        className={`flex ${
                          m.is_ai
                            ? "justify-start"
                            : "justify-end"
                        }`}
                      >
                        <div
                          className={`
                            max-w-[80%]
                            rounded-2xl
                            px-4
                            py-3
                            ${
                              m.is_ai
                                ? "bg-[#151515] border border-white/10"
                                : "bg-white text-black"
                            }
                          `}
                        >
                          <div
                            className={`
                              text-xs
                              font-bold
                              mb-1
                              tracking-wide
                              ${
                                m.is_ai
                                  ? "text-white"
                                  : "text-black"
                              }
                            `}
                          >
                            {m.is_ai
                              ? "AI Tutor"
                              : m.username}
                          </div>

                          <p
                            className={`
                              text-sm
                              leading-6
                              whitespace-pre-wrap
                              ${
                                m.is_ai
                                  ? "text-gray-200"
                                  : "text-black"
                              }
                            `}
                          >
                            {
                              m.content
                            }
                          </p>

                          <p className="text-[10px] mt-2 text-gray-500">
                            {new Date(
                              m.created_at
                            ).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute:
                                  "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            {/* CHAT INPUT */}

            <div className="flex gap-3 items-center">
              <input
                value={
                  chatInput
                }
                onChange={(
                  e
                ) =>
                  setChatInput(
                    e.target
                      .value
                  )
                }
                onKeyDown={(
                  e
                ) => {
                  if (
                    e.key ===
                      "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask the tutor or chat with your group..."
                className="
                  flex-1
                  rounded-xl
                  border border-white/10
                  bg-[#111111]
                  text-white
                  placeholder:text-gray-500
                  px-4 py-3
                  outline-none
                  focus:border-white/30
                  transition
                "
              />

              <button
                onClick={
                  sendMessage
                }
                disabled={
                  chatLoading ||
                  !chatInput.trim()
                }
                className="
                  rounded-xl
                  bg-white
                  text-black
                  px-5 py-3
                  font-semibold
                  transition
                  hover:bg-gray-200
                  disabled:opacity-40
                  disabled:cursor-not-allowed
                "
              >
                {chatLoading
                  ? "Thinking..."
                  : "Send"}
              </button>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* MEMBERS */}
        {/* ================================================= */}

        {activeTab ===
          "members" && (
          <div>
            <h2 className="font-bold text-white text-lg mb-4">
              Room Members (
              {members.length})
            </h2>

            <ul className="flex flex-col gap-3">
              {members.map(
                (m) => (
                  <li
                    key={
                      m.user_id
                    }
                    className="
                      flex
                      items-center
                      justify-between
                      p-3
                      rounded-xl
                      border
                      border-white/10
                      bg-[#0d0d0d]
                    "
                  >
                    <span className="text-white">
                      {m.username}

                      {m.user_id ===
                        userId &&
                        " (you)"}
                    </span>

                    <span className="text-xs text-gray-500">
                      {getMemberPercent(
                        m.user_id
                      )}
                      % done
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
} 