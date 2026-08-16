"use server";

import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");
  return { supabase, user };
}

async function isRoomMember(
  supabase: SupabaseClient,
  roomId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function generateUniqueInviteCode(
  supabase: SupabaseClient
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = nanoid(6).toUpperCase();
    const { data } = await supabase
      .from("rooms")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate a unique invite code, try again");
}

export async function createRoom(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = formData.get("name") as string;
  if (!name || !name.trim()) throw new Error("Room name is required");

  const inviteCode = await generateUniqueInviteCode(supabase);

  const { data, error } = await supabase
    .from("rooms")
    .insert({ name, invite_code: inviteCode, created_by: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("room_members").insert({
    room_id: data.id,
    user_id: user.id,
  });

  redirect(`/room/${data.id}`);
}

export async function joinRoom(formData: FormData) {
  const { supabase, user } = await requireUser();

  const code = (formData.get("code") as string).toUpperCase();
  if (!code) throw new Error("Invite code is required");

  const { data: room, error } = await supabase
    .from("rooms")
    .select("id")
    .eq("invite_code", code)
    .single();

  if (error || !room) throw new Error("Room not found");

  const alreadyMember = await isRoomMember(supabase, room.id, user.id);
  if (!alreadyMember) {
    await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: user.id,
    });
  }

  redirect(`/room/${room.id}`);
}

export async function updateRoomName(roomId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = formData.get("name") as string;
  if (!name || !name.trim()) throw new Error("Room name is required");

  if (!(await isRoomMember(supabase, roomId, user.id))) {
    throw new Error("You are not a member of this room");
  }

  const { error } = await supabase.from("rooms").update({ name }).eq("id", roomId);
  if (error) throw new Error(error.message);
}

export async function leaveRoom(roomId: string) {
  const { supabase, user } = await requireUser();

  await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  redirect("/dashboard");
}

async function getRoadmapRoomId(supabase: SupabaseClient, roadmapId: string) {
  const { data } = await supabase
    .from("roadmaps")
    .select("room_id")
    .eq("id", roadmapId)
    .maybeSingle();
  return data?.room_id ?? null;
}

export async function deleteRoadmap(roadmapId: string) {
  const { supabase, user } = await requireUser();

  const roomId = await getRoadmapRoomId(supabase, roadmapId);
  if (!roomId) throw new Error("Roadmap not found");
  if (!(await isRoomMember(supabase, roomId, user.id))) {
    throw new Error("You are not a member of this room");
  }

  const { error } = await supabase.from("roadmaps").delete().eq("id", roadmapId);
  if (error) throw new Error(error.message);
}

export async function deleteTasks(roadmapId: string, stepId: number) {
  const { supabase, user } = await requireUser();

  const roomId = await getRoadmapRoomId(supabase, roadmapId);
  if (!roomId) throw new Error("Roadmap not found");
  if (!(await isRoomMember(supabase, roomId, user.id))) {
    throw new Error("You are not a member of this room");
  }

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("roadmap_id", roadmapId)
    .eq("step_id", stepId);
  if (error) throw new Error(error.message);
}
