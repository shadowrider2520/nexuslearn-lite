export type Step = {
  id: number;
  day: number;
  title: string;
  description: string;
  estimated_minutes: number;
};

export type TaskItem = {
  id: number;
  type: "task" | "project";
  title: string;
  description: string;
};

export type ChatMessage = {
  id: string;
  username: string;
  content: string;
  is_ai: boolean;
  created_at: string;
};

export type ProgressRow = {
  step_id: number;
  user_id: string;
  completed: boolean;
};

export type TaskProgressRow = {
  step_id: number;
  task_id: number;
  user_id: string;
  completed: boolean;
};

export type RoadmapMeta = {
  id: string;
  topic: string;
  created_at: string;
};

export type Member = {
  user_id: string;
  username: string;
};

export type Room = {
  name: string;
  invite_code: string;
  created_by: string;
};

export type RoomTab = "roadmap" | "chat" | "members";
