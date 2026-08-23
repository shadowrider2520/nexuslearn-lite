"use client";

import { Geist, Young_Serif } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteRoadmap, deleteTasks } from "../../actions";
import { getFileExtension, validateDocument } from "@/lib/documents";
import { DocumentsPanel } from "../components/DocumentsPanel";
import type {
  ChatMessage,
  Member,
  ProgressRow,
  RoadmapMeta,
  Room,
  RoomDocument,
  RoomTab,
  Step,
  TaskItem,
  TaskProgressRow,
} from "@/lib/types";
import { ChatPanel } from "../components/ChatPanel";
import { MembersPanel } from "../components/MembersPanel";
import { RoadmapPanel, type TaskError } from "../components/RoadmapPanel";
import { RoomNavbar } from "../components/RoomNavbar";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const youngSerif = Young_Serif({
  subsets: ["latin"],
  variable: "--font-young-serif",
  weight: "400",
});

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {

  // Documents uploading

  
  

  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);

  const [members, setMembers] = useState<Member[]>([]);

  const [userId, setUserId] = useState("");

  /*
   * ROADMAP
   */

  const [roadmapsList, setRoadmapsList] = useState<RoadmapMeta[]>([]);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);

  const [steps, setSteps] = useState<Step[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);

  /*
   * TASKS
   */

  const [tasksByStep, setTasksByStep] = useState<Record<number, TaskItem[]>>({});
  const [taskProgress, setTaskProgress] = useState<TaskProgressRow[]>([]);
  const [taskLoadingStep, setTaskLoadingStep] = useState<number | null>(null);
  const [taskError, setTaskError] = useState<TaskError>(null);

  /*
   * CHAT
   */

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [documents, setDocuments] = useState<RoomDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  /*
   * ROADMAP GENERATION
   */

  const [topic, setTopic] = useState("");
  const [minutesPerDay, setMinutesPerDay] = useState(30);
  const [detailLevel, setDetailLevel] = useState("detailed");

  const [formStep, setFormStep] = useState<"topic" | "prefs">("topic");
  const [showNewRoadmapForm, setShowNewRoadmapForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);

  /*
   * ACTIVE TAB
   */

  const [activeTab, setActiveTab] = useState<RoomTab>("roadmap");

  const supabase = useMemo(() => createClient(), []);

  /*
   * GET ROOM ID
   */

  useEffect(() => {
    params.then((p) => setRoomId(p.id));
  }, [params]);

  /*
   * LOAD ROOM + MEMBERS
   */

  const loadRoomAndMembers = useCallback(async () => {
    if (!roomId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("name, invite_code, created_by")
      .eq("id", roomId)
      .single();

    if (roomError) {
      console.error("ROOM LOAD ERROR:", roomError);
      router.replace("/dashboard");
      return;
    }

    setRoom(roomData);

    const { data: memberRows, error: memberError } = await supabase
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

    const { data: profileRows, error: profileError } = await supabase
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
          profileRows?.find((p) => p.id === m.user_id)?.username ?? "Unknown",
      }))
    );
  }, [roomId, router, supabase]);

  /*
   * LOAD ROADMAP LIST
   */

  const loadRoadmapsList = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("roadmaps")
      .select("id, topic, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("ROADMAP LIST ERROR:", error);
      return;
    }

    if (data) {
      setRoadmapsList(data);

      if (!activeRoadmapId && data.length > 0) {
        setActiveRoadmapId(data[0].id);
      }
    }
  }, [roomId, supabase, activeRoadmapId]);

  /*
   * LOAD ACTIVE ROADMAP
   */

  const loadActiveRoadmapData = useCallback(async (roadmapId: string) => {
    /*
     * ROADMAP STEPS
     */

    const { data: roadmapData, error: roadmapError } = await supabase
      .from("roadmaps")
      .select("steps")
      .eq("id", roadmapId)
      .single();

    if (roadmapError) {
      console.error("ROADMAP DATA ERROR:", roadmapError);
    } else if (roadmapData) {
      setSteps(roadmapData.steps as Step[]);
    }

    /*
     * STEP PROGRESS
     */

    const { data: progressData, error: progressError } = await supabase
      .from("progress")
      .select("step_id, user_id, completed")
      .eq("roadmap_id", roadmapId);

    if (progressError) {
      console.error("PROGRESS LOAD ERROR:", progressError);
    } else {
      setProgress((progressData ?? []) as ProgressRow[]);
    }

    /*
     * TASKS
     */

    const { data: taskRows, error: taskError } = await supabase
      .from("tasks")
      .select("step_id, items")
      .eq("roadmap_id", roadmapId);

    if (taskError) {
      console.error("TASK LOAD ERROR:", taskError);
    }

    const map: Record<number, TaskItem[]> = {};

    (taskRows ?? []).forEach((row: { step_id: number; items: TaskItem[] }) => {
      map[row.step_id] = row.items ?? [];
    });

    setTasksByStep(map);

    /*
     * TASK PROGRESS
     */

    const { data: taskProgressData, error: taskProgressError } = await supabase
      .from("task_progress")
      .select("step_id, task_id, user_id, completed")
      .eq("roadmap_id", roadmapId);

    if (taskProgressError) {
      console.error("TASK PROGRESS LOAD ERROR:", taskProgressError);
    } else {
      setTaskProgress((taskProgressData ?? []) as TaskProgressRow[]);
    }
  }, [supabase]);

  /*
  *DOCUMENT UPLOAD
  */
    /*
   * LOAD CHAT MESSAGES
   */

  const loadMessages = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("id, username, content, is_ai, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("MESSAGES LOAD ERROR:", error);
      return;
    }

    if (data) {
      setMessages(data as ChatMessage[]);
    }
  }, [roomId, supabase]);

  const loadDocuments = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("documents")
      .select("id, file_name, file_path, file_size, file_type, uploaded_by, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("DOCUMENTS LOAD ERROR:", error);
      setDocumentError("Could not load documents. Try refreshing the room.");
      return;
    }

    setDocuments((data ?? []) as RoomDocument[]);
  }, [roomId, supabase]);

  /*
   * ROOM REALTIME
   */

  useEffect(() => {
    if (!roomId) return;

    // Defer the initial loads so the effect body stays free of
    // synchronous state updates; the loaders are async anyway.
    Promise.resolve().then(() => {
      loadRoomAndMembers();
      loadRoadmapsList();
      loadMessages();
      loadDocuments();
    });

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

    const documentChannel = supabase
      .channel(`documents-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memberChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(documentChannel);
    };
  }, [roomId, supabase, loadDocuments, loadRoomAndMembers, loadRoadmapsList, loadMessages]);

  /*
   * ACTIVE ROADMAP REALTIME
   */

  useEffect(() => {
    if (!activeRoadmapId) return;

    Promise.resolve().then(() => {
      loadActiveRoadmapData(activeRoadmapId);
    });

    /*
     * STEP PROGRESS REALTIME
     */

    const progressChannel = supabase
      .channel(`progress-${activeRoadmapId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "progress",
          filter: `roadmap_id=eq.${activeRoadmapId}`,
        },
        () => {
          loadActiveRoadmapData(activeRoadmapId);
        }
      )
      .subscribe();

    /*
     * TASK PROGRESS REALTIME
     */

    const taskProgressChannel = supabase
      .channel(`task-progress-${activeRoadmapId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_progress",
          filter: `roadmap_id=eq.${activeRoadmapId}`,
        },
        () => {
          loadActiveRoadmapData(activeRoadmapId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(taskProgressChannel);
    };
  }, [activeRoadmapId, supabase, loadActiveRoadmapData]);

  /*
   * GENERATE ROADMAP
   */

  const generateRoadmap = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setRoadmapError(null);

    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          roomId,
          minutesPerDay,
          detailLevel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRoadmapError(data.error ?? "Something went wrong. Try again.");
        return;
      }

      setShowNewRoadmapForm(false);
      setFormStep("topic");
      setTopic("");

      await loadRoadmapsList();

      if (data.id) {
        setActiveRoadmapId(data.id);
      }
    } catch {
      setRoadmapError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * DELETE ROADMAP
   */

  const handleDeleteRoadmap = async (roadmapId: string) => {
    try {
      await deleteRoadmap(roadmapId);

      if (activeRoadmapId === roadmapId) {
        setActiveRoadmapId(null);
        setSteps([]);
        setProgress([]);
        setTaskProgress([]);
        setTasksByStep({});
      }

      await loadRoadmapsList();
    } catch (error) {
      console.error("DELETE ROADMAP ERROR:", error);
    }
  };

  /*
   * TOGGLE STEP
   */

  const toggleStep = async (stepId: number, currentlyDone: boolean) => {
    if (!activeRoadmapId || !userId) return;

    const newCompleted = !currentlyDone;

    const { error } = await supabase
      .from("progress")
      .upsert(
        {
          room_id: roomId,
          roadmap_id: activeRoadmapId,
          step_id: stepId,
          user_id: userId,
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        },
        {
          onConflict: "roadmap_id,step_id,user_id",
        }
      );

    if (error) {
      console.error("STEP PROGRESS ERROR:", error);
      return;
    }

    /*
     * Update UI immediately
     */

    setProgress((prev) => {
      const existing = prev.find(
        (p) => p.step_id === stepId && p.user_id === userId
      );

      if (existing) {
        return prev.map((p) =>
          p.step_id === stepId && p.user_id === userId
            ? { ...p, completed: newCompleted }
            : p
        );
      }

      return [
        ...prev,
        {
          step_id: stepId,
          user_id: userId,
          completed: newCompleted,
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
    if (!activeRoadmapId || !userId) return;

    const newCompleted = !currentlyDone;

    const { error } = await supabase
      .from("task_progress")
      .upsert(
        {
          room_id: roomId,
          roadmap_id: activeRoadmapId,
          step_id: stepId,
          task_id: taskId,
          user_id: userId,
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        },
        {
          onConflict: "roadmap_id,step_id,task_id,user_id",
        }
      );

    if (error) {
      console.error("TASK PROGRESS ERROR:", error);
      return;
    }

    /*
     * Update UI immediately
     */

    setTaskProgress((prev) => {
      const existing = prev.find(
        (p) =>
          p.step_id === stepId &&
          p.task_id === taskId &&
          p.user_id === userId
      );

      if (existing) {
        return prev.map((p) =>
          p.step_id === stepId &&
          p.task_id === taskId &&
          p.user_id === userId
            ? { ...p, completed: newCompleted }
            : p
        );
      }

      return [
        ...prev,
        {
          step_id: stepId,
          task_id: taskId,
          user_id: userId,
          completed: newCompleted,
        },
      ];
    });
  };

  /*
   * GENERATE TASKS
   */

  const generateTasksForStep = async (step: Step) => {
    if (!activeRoadmapId) return;

    setTaskLoadingStep(step.id);
    setTaskError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          roadmapId: activeRoadmapId,
          stepId: step.id,
          stepTitle: step.title,
          stepDescription: step.description,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTaskError({
          stepId: step.id,
          message: data.error ?? "Couldn't generate tasks. Try again.",
        });
        return;
      }

      setTasksByStep((prev) => ({
        ...prev,
        [step.id]: data.items ?? [],
      }));

      /*
       * Reload task progress after generating tasks.
       */

      await loadActiveRoadmapData(activeRoadmapId);
    } catch {
      setTaskError({
        stepId: step.id,
        message: "Couldn't reach the server. Try again.",
      });
    } finally {
      setTaskLoadingStep(null);
    }
  };

  /*
   * DELETE TASKS
   */

  const handleDeleteTasks = async (stepId: number) => {
    if (!activeRoadmapId) return;

    try {
      await deleteTasks(activeRoadmapId, stepId);

      setTasksByStep((prev) => {
        const copy = { ...prev };
        delete copy[stepId];
        return copy;
      });

      setTaskError((prev) => (prev?.stepId === stepId ? null : prev));

      /*
       * Remove old task progress from local state.
       */

      setTaskProgress((prev) => prev.filter((p) => p.step_id !== stepId));
    } catch (error) {
      console.error("DELETE TASKS ERROR:", error);
    }
  };

  /*
   * SEND CHAT MESSAGE
   */

  const sendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          content: chatInput.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setChatError(result.error ?? "Couldn't send your message. Try again.");
        return;
      }

      setChatInput("");

      /*
       * Realtime will normally update the messages.
       *
       * This also ensures the current sender sees the
       * latest state immediately.
       */

      await loadMessages();
    } catch {
      setChatError("Couldn't reach the server. Try again.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !roomId || !userId) return;

    const validationError = validateDocument(file);
    if (validationError) {
      setDocumentError(validationError);
      return;
    }

    setUploading(true);
    setDocumentError(null);

    const filePath = `${roomId}/${crypto.randomUUID()}.${getFileExtension(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("room-documents")
      .upload(filePath, file, { contentType: file.type || undefined });

    if (uploadError) {
      setDocumentError(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: documentInsertError } = await supabase.from("documents").insert({
      room_id: roomId,
      uploaded_by: userId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type || null,
    });

    if (documentInsertError) {
      await supabase.storage.from("room-documents").remove([filePath]);
      setDocumentError(`Could not save the document: ${documentInsertError.message}`);
    } else {
      await loadDocuments();
    }

    setUploading(false);
  };

const downloadDocument = async (filePath: string, fileName: string) => {
  setDocumentError(null);
  const { data, error } = await supabase.storage.from("room-documents").download(filePath);
  if (error) {
    setDocumentError(`Download failed: ${error.message}`);
    return;
  }
  if (data) {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
};

const handleDeleteDocument = async (docId: string, filePath: string) => {
  setDocumentError(null);
  const { error: storageError } = await supabase.storage.from("room-documents").remove([filePath]);
  if (storageError) {
    setDocumentError(`Could not delete the file: ${storageError.message}`);
    return;
  }

  const { error: documentError } = await supabase.from("documents").delete().eq("id", docId);
  if (documentError) {
    setDocumentError(`The file was removed, but its record could not be deleted: ${documentError.message}`);
    return;
  }

  await loadDocuments();
};

  /*
   * COMPLETED USERS
   */

  const getCompletedUsers = (stepId: number) =>
    progress
      .filter((p) => p.step_id === stepId && p.completed)
      .map(
        (p) =>
          members.find((m) => m.user_id === p.user_id)?.username ?? "?"
      );
  
  /*
  *DOCUMENT UPLOAD
  */
 

  /*
   * MEMBER PROGRESS
   */

  const getMemberPercent = (memberId: string) => {
    if (steps.length === 0) return 0;

    const done = progress.filter(
      (p) => p.user_id === memberId && p.completed
    ).length;

    return Math.round((done / steps.length) * 100);
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

  const isHost = userId === room.created_by;

  const dayNumbers = [...new Set(steps.map((s) => s.day))];

  return (
    <div className={`${geist.variable} ${youngSerif.variable} nx-bg flex h-screen flex-col text-white`}>
      {/* NAVBAR */}

      <RoomNavbar
        roomName={room.name}
        inviteCode={room.invite_code}
        roomId={roomId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* MAIN CONTENT */}

      <div className="mx-auto w-full max-w-4xl flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-10">
        {/* ROADMAP */}

        {activeTab === "roadmap" && (
          <RoadmapPanel
            roomId={roomId}
            isHost={isHost}
            members={members}
            userId={userId}
            steps={steps}
            progress={progress}
            dayNumbers={dayNumbers}
            roadmapsList={roadmapsList}
            activeRoadmapId={activeRoadmapId}
            onSelectRoadmap={setActiveRoadmapId}
            onDeleteRoadmap={handleDeleteRoadmap}
            showNewRoadmapForm={showNewRoadmapForm}
            formStep={formStep}
            topic={topic}
            minutesPerDay={minutesPerDay}
            detailLevel={detailLevel}
            loading={loading}
            roadmapError={roadmapError}
            onOpenNewRoadmapForm={() => setShowNewRoadmapForm(true)}
            onCloseNewRoadmapForm={() => setShowNewRoadmapForm(false)}
            onTopicChange={setTopic}
            onGoToPrefs={() => setFormStep("prefs")}
            onBackToTopic={() => setFormStep("topic")}
            onMinutesChange={setMinutesPerDay}
            onDetailLevelChange={setDetailLevel}
            onGenerateRoadmap={generateRoadmap}
            tasksByStep={tasksByStep}
            taskProgress={taskProgress}
            taskLoadingStep={taskLoadingStep}
            taskError={taskError}
            onGenerateTasksForStep={generateTasksForStep}
            onDeleteTasksForStep={handleDeleteTasks}
            onToggleStep={toggleStep}
            onToggleTask={toggleTask}
            getCompletedUsers={getCompletedUsers}
            memberPercent={getMemberPercent}
          />
        )}

        {/* CHAT */}

        {activeTab === "chat" && (
          <ChatPanel
            messages={messages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={sendMessage}
            loading={chatLoading}
            error={chatError}
          />
        )}

        {/* MEMBERS */}

        {activeTab === "members" && (
          <MembersPanel
            members={members}
            userId={userId}
            memberPercent={getMemberPercent}
          />
        )}
          {activeTab === "documents" && (
  <DocumentsPanel
    documents={documents}
    uploading={uploading}
    error={documentError}
    userId={userId}
    onUpload={handleFileUpload}
    onDownload={downloadDocument}
    onDelete={handleDeleteDocument}
  />
    )}
      </div>
    </div>
  );
}
