import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { patchPayload } from "@/lib/projects-payload";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/projects/:id — load one saved funnel (RLS ensures ownership).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("funnel_projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return Response.json({ error: error.message }, { status: 404 });

  return Response.json({ project: data });
}

// PATCH /api/projects/:id — rename and/or update the saved data.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch = patchPayload(body);
  if (!patch) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("funnel_projects")
    .update(patch)
    .eq("id", id)
    .select("id, name, updated_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ project: data });
}

// DELETE /api/projects/:id — delete one saved funnel.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "Supabase not configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("funnel_projects").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
