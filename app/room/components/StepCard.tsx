"use client";

import type { Step, TaskItem, TaskProgressRow } from "@/lib/types";

export function StepCard({
  step,
  myDone,
  onToggleStep,
  completedByUsernames,
  tasks,
  taskProgress,
  userId,
  taskLoading,
  taskError,
  onGenerateTasks,
  onDeleteTasks,
  onToggleTask,
}: {
  step: Step;
  myDone: boolean;
  onToggleStep: () => void;
  completedByUsernames: string[];
  tasks: TaskItem[] | undefined;
  taskProgress: TaskProgressRow[];
  userId: string;
  taskLoading: boolean;
  taskError: string | null;
  onGenerateTasks: () => void;
  onDeleteTasks: () => void;
  onToggleTask: (taskId: number, done: boolean) => void;
}) {
  return (
    <li className="nx-glass group rounded-2xl p-5 transition hover:border-white/20">
      <div className="flex items-start gap-3.5">
        {/* STEP CHECKBOX */}

        <input
          type="checkbox"
          checked={myDone}
          onChange={onToggleStep}
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
            {!tasks ? (
              <div>
                <button
                  onClick={onGenerateTasks}
                  disabled={taskLoading}
                  className="text-xs text-gray-400 underline underline-offset-2 transition hover:text-purple-300 disabled:opacity-50"
                >
                  {taskLoading ? "Generating…" : "Generate tasks & mini-project"}
                </button>

                {taskError && (
                  <p className="mt-2 text-xs text-red-400">{taskError}</p>
                )}
              </div>
            ) : (
              <div>
                {/* TASK HEADER */}

                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Tasks & Projects
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={onGenerateTasks}
                      disabled={taskLoading}
                      className="text-xs text-gray-400 underline transition hover:text-purple-300 disabled:opacity-50"
                    >
                      {taskLoading ? "Generating…" : "Regenerate"}
                    </button>
                    <button
                      onClick={onDeleteTasks}
                      className="text-xs text-red-400 underline transition hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {taskError && (
                  <p className="mb-2 text-xs text-red-400">{taskError}</p>
                )}

                {/* TASK LIST */}

                <ul className="flex flex-col gap-2">
                  {tasks.map((t) => {
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
                          onChange={() => onToggleTask(t.id, taskDone)}
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
}
