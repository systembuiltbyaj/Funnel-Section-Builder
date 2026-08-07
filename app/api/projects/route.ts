import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/projects — list the signed-in user's saved funnels (RLS-scoped).
export async function GET() {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("funnel_projects")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ projects: data });
}

// POST /api/projects — create a saved funnel { name, data }.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name =
    (typeof body.name === "string" && body.name.trim()) || "Untitled funnel";

  const { data, error } = await supabase
    .from("funnel_projects")
    .insert({ user_id: user.id, name: name.slice(0, 120), data: body.data ?? {} })
    .select("id, name, updated_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ project: data }, { status: 201 });
}
