const express = require("express");
const { supabase } = require("../supabase");

const router = express.Router();
const STATUSES = ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Remote"];
const FIELDS = ["company", "role", "location", "job_type", "date_applied", "status", "follow_up_date", "job_url", "salary", "notes"];

function databaseReady(res) {
  if (!supabase) {
    res.status(503).json({ error: "Database is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend/.env and restart the server." });
    return false;
  }
  return true;
}
function validate(body, partial = false) {
  const errors = [];
  if (!partial || body.company !== undefined) {
    if (typeof body.company !== "string" || body.company.trim().length < 1 || body.company.trim().length > 120) errors.push("Company must contain 1–120 characters.");
  }
  if (!partial || body.role !== undefined) {
    if (typeof body.role !== "string" || body.role.trim().length < 1 || body.role.trim().length > 120) errors.push("Job title must contain 1–120 characters.");
  }
  if (body.location !== undefined && (typeof body.location !== "string" || body.location.length > 120)) errors.push("Location must be at most 120 characters.");
  if (body.job_type !== undefined && !JOB_TYPES.includes(body.job_type)) errors.push("Choose a valid job type.");
  if (body.status !== undefined && !STATUSES.includes(body.status)) errors.push("Choose a valid status.");
  if ((!partial || body.date_applied !== undefined) && !validDate(body.date_applied)) errors.push("A valid date applied is required (YYYY-MM-DD).");
  if (body.follow_up_date !== undefined && body.follow_up_date !== null && body.follow_up_date !== "" && !validDate(body.follow_up_date)) errors.push("Follow-up date must be a valid date (YYYY-MM-DD).");
  for (const field of ["salary", "notes"]) if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > (field === "notes" ? 3000 : 100))) errors.push(`${field} is too long or invalid.`);
  if (body.job_url !== undefined && body.job_url !== "") {
    try { const u = new URL(body.job_url); if (!["http:", "https:"].includes(u.protocol)) throw new Error(); }
    catch { errors.push("Job posting URL must be a valid http or https URL."); }
    if (body.job_url.length > 500) errors.push("Job posting URL must be at most 500 characters.");
  }
  return errors;
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function clean(body, partial = false) {
  const out = {};
  for (const field of FIELDS) {
    if (body[field] !== undefined) {
      let value = body[field];
      if (typeof value === "string") value = value.trim();
      if (["location", "follow_up_date", "job_url", "salary", "notes"].includes(field) && value === "") value = null;
      out[field] = value;
    }
  }
  if (!partial) {
    if (out.location === undefined) out.location = null;
    if (out.job_type === undefined) out.job_type = "Full-time";
    if (out.status === undefined) out.status = "Applied";
    if (out.follow_up_date === undefined) out.follow_up_date = null;
    if (out.job_url === undefined) out.job_url = null;
    if (out.salary === undefined) out.salary = null;
    if (out.notes === undefined) out.notes = null;
  }
  return out;
}
function sendDbError(res, error) {
  console.error("Supabase request failed:", error.message);
  return res.status(500).json({ error: "The database request failed. Verify the database schema and Supabase configuration." });
}

router.get("/", async (req, res) => {
  if (!databaseReady(res)) return;
  const { data, error } = await supabase.from("applications").select("*").order("date_applied", { ascending: false }).order("created_at", { ascending: false });
  if (error) return sendDbError(res, error);
  res.json({ applications: data });
});

router.post("/", async (req, res) => {
  if (!databaseReady(res)) return;
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });
  const { data, error } = await supabase.from("applications").insert(clean(req.body)).select("*").single();
  if (error) return sendDbError(res, error);
  res.status(201).json({ application: data });
});

router.get("/:id", async (req, res) => {
  if (!databaseReady(res)) return;
  const { data, error } = await supabase.from("applications").select("*").eq("id", req.params.id).maybeSingle();
  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: "Application not found." });
  res.json({ application: data });
});

router.put("/:id", async (req, res) => {
  if (!databaseReady(res)) return;
  const errors = validate(req.body, true);
  if (!Object.keys(clean(req.body, true)).length) errors.push("Provide at least one field to update.");
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });
  const { data, error } = await supabase.from("applications").update(clean(req.body, true)).eq("id", req.params.id).select("*").maybeSingle();
  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: "Application not found." });
  res.json({ application: data });
});

router.delete("/:id", async (req, res) => {
  if (!databaseReady(res)) return;
  const { data, error } = await supabase.from("applications").delete().eq("id", req.params.id).select("id").maybeSingle();
  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: "Application not found." });
  res.json({ message: "Application deleted successfully." });
});

module.exports = router;
