"use server";

import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

export async function createRoom(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");
  console.log("DEBUG USER ID:", user.id);
  const { data: whoamiResult } = await supabase.rpc("whoami");
  console.log("DB SEES AUTH.UID() AS:", whoamiResult);
  const name = formData.get("name") as string;
  const inviteCode = nanoid(6).toUpperCase();

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in");

  const code = (formData.get("code") as string).toUpperCase();

  const { data: room, error } = await supabase
    .from("rooms")
    .select("id")
    .eq("invite_code", code)
    .single();

  if (error || !room) throw new Error("Room not found");

  await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: user.id,
  });

  redirect(`/room/${room.id}`);
}
export async function updateRoomName(roomId: string, formData: FormData) {
  const supabase = await createClient();
  const name = formData.get("name") as string;
  await supabase.from("rooms").update({ name }).eq("id", roomId);
}

export async function leaveRoom(roomId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("room_members").delete().eq("room_id", roomId).eq("user_id", user.id);
  redirect("/");
}

export async function deleteRoadmap(roadmapId: string) {
  const supabase = await createClient();
  await supabase.from("roadmaps").delete().eq("id", roadmapId);
}

export async function deleteTasks(roadmapId: string, stepId: number) {
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("roadmap_id", roadmapId).eq("step_id", stepId);
}