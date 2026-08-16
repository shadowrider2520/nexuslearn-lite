"use client";

import { updateRoomName } from "../../actions";
import type {
  Member,
  ProgressRow,
  RoadmapMeta,
  Step,
  TaskItem,
  TaskProgressRow,
} from "@/lib/types";
import { Avatar } from "./Avatar";
import { StepCard } from "./StepCard";

export type TaskError = { stepId: number; message: string } | null;

export function RoadmapPanel({
  roomId,
  isHost,
  members,
  userId,
  steps,
  progress,
  dayNumbers,
  roadmapsList,
  activeRoadmapId,
  onSelectRoadmap,
  onDeleteRoadmap,
  showNewRoadmapForm,
  formStep,
  topic,
  minutesPerDay,
  detailLevel,
  loading,
  roadmapError,
  onOpenNewRoadmapForm,
  onCloseNewRoadmapForm,
  onTopicChange,
  onGoToPrefs,
  onBackToTopic,
  onMinutesChange,
  onDetailLevelChange,
  onGenerateRoadmap,
  tasksByStep,
  taskProgress,
  taskLoadingStep,
  taskError,
  onGenerateTasksForStep,
  onDeleteTasksForStep,
  onToggleStep,
  onToggleTask,
  getCompletedUsers,
  memberPercent,
}: {
  roomId: string;
  isHost: boolean;
  members: Member[];
  userId: string;
  steps: Step[];
  progress: ProgressRow[];
  dayNumbers: number[];
  roadmapsList: RoadmapMeta[];
  activeRoadmapId: string | null;
  onSelectRoadmap: (id: string) => void;
  onDeleteRoadmap: (id: string) => void;
  showNewRoadmapForm: boolean;
  formStep: "topic" | "prefs";
  topic: string;
  minutesPerDay: number;
  detailLevel: string;
  loading: boolean;
  roadmapError: string | null;
  onOpenNewRoadmapForm: () => void;
  onCloseNewRoadmapForm: () => void;
  onTopicChange: (value: string) => void;
  onGoToPrefs: () => void;
  onBackToTopic: () => void;
  onMinutesChange: (value: number) => void;
  onDetailLevelChange: (value: string) => void;
  onGenerateRoadmap: () => void;
  tasksByStep: Record<number, TaskItem[]>;
  taskProgress: TaskProgressRow[];
  taskLoadingStep: number | null;
  taskError: TaskError;
  onGenerateTasksForStep: (step: Step) => void;
  onDeleteTasksForStep: (stepId: number) => void;
  onToggleStep: (stepId: number, currentlyDone: boolean) => void;
  onToggleTask: (stepId: number, taskId: number, currentlyDone: boolean) => void;
  getCompletedUsers: (stepId: number) => string[];
  memberPercent: (memberId: string) => number;
}) {
  return (
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
            {members.map((m) => {
              const pct = memberPercent(m.user_id);

              return (
                <div key={m.user_id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={m.username} className="h-7 w-7 text-[10px]" />
                      <span className="text-white">
                        {m.username}
                        {m.user_id === userId && (
                          <span className="ml-1 text-gray-500">(you)</span>
                        )}
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
                  {pct === 100 && (
                    <p className="mt-2 text-xs text-gray-500">Roadmap completed 🎉</p>
                  )}
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
            onClick={onOpenNewRoadmapForm}
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
                <button onClick={() => onSelectRoadmap(r.id)}>{r.topic}</button>
                <button
                  onClick={() => onDeleteRoadmap(r.id)}
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
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="Paste a topic or notes…"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
              />
              <button
                onClick={() => {
                  if (topic.trim()) onGoToPrefs();
                }}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gray-200"
              >
                Next
              </button>
              <button
                onClick={onCloseNewRoadmapForm}
                className="px-2 text-sm text-gray-400 underline transition hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="nx-glass nx-fade mb-5 flex flex-col gap-5 rounded-2xl p-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Minutes per day?
                </label>
                <input
                  type="number"
                  value={minutesPerDay}
                  onChange={(e) => onMinutesChange(Number(e.target.value))}
                  className="w-32 rounded-xl border border-white/10 bg-black/40 p-2 text-sm text-white outline-none transition focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Complexity?
                </label>
                <div className="flex flex-wrap gap-2">
                  {["quick", "detailed", "thorough"].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => onDetailLevelChange(lvl)}
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

              {roadmapError && (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {roadmapError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={onBackToTopic}
                  className="text-sm text-gray-400 underline transition hover:text-white"
                >
                  Back
                </button>
                <button
                  onClick={onGenerateRoadmap}
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
                      (p) =>
                        p.step_id === step.id &&
                        p.user_id === userId &&
                        p.completed
                    );

                    const stepTasks = tasksByStep[step.id];
                    const stepTaskError =
                      taskError && taskError.stepId === step.id
                        ? taskError.message
                        : null;

                    return (
                      <StepCard
                        key={step.id}
                        step={step}
                        myDone={myDone}
                        onToggleStep={() => onToggleStep(step.id, myDone)}
                        completedByUsernames={getCompletedUsers(step.id)}
                        tasks={stepTasks}
                        taskProgress={taskProgress}
                        userId={userId}
                        taskLoading={taskLoadingStep === step.id}
                        taskError={stepTaskError}
                        onGenerateTasks={() => onGenerateTasksForStep(step)}
                        onDeleteTasks={() => onDeleteTasksForStep(step.id)}
                        onToggleTask={(taskId, done) =>
                          onToggleTask(step.id, taskId, done)
                        }
                      />
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
