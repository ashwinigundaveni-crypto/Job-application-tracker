// Run with: npm start in one terminal, then node test-api.js in another.
// Requires a configured Supabase project for CRUD tests.
const base = process.env.API_BASE_URL || "http://localhost:3000";
async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}
(async () => {
  const health = await call("/api/health");
  if (health.status !== 200 || health.body.status !== "ok") throw new Error("Health check failed");
  console.log("PASS health endpoint");
  if (!health.body.databaseConfigured) {
    console.log("SKIP CRUD checks: configure Supabase in backend/.env first.");
    return;
  }
  const created = await call("/api/applications", { method: "POST", body: JSON.stringify({
    company: "JobTrack Test Company", role: "Automated API Test", job_type: "Internship",
    date_applied: new Date().toISOString().slice(0, 10), status: "Saved", notes: "Temporary test record"
  })});
  if (created.status !== 201 || !created.body.application?.id) throw new Error(`Create failed: ${JSON.stringify(created.body)}`);
  const id = created.body.application.id;
  try {
    const listed = await call("/api/applications");
    if (listed.status !== 200 || !listed.body.applications.some(a => a.id === id)) throw new Error("List/read check failed");
    console.log("PASS create and list endpoints");
    const updated = await call(`/api/applications/${id}`, { method: "PUT", body: JSON.stringify({ status: "Interview" }) });
    if (updated.status !== 200 || updated.body.application.status !== "Interview") throw new Error("Update check failed");
    console.log("PASS update endpoint");
  } finally {
    const deleted = await call(`/api/applications/${id}`, { method: "DELETE" });
    if (deleted.status !== 200) throw new Error("Cleanup/delete check failed");
  }
  console.log("PASS delete endpoint; test record cleaned up");
})().catch(error => { console.error("FAIL:", error.message); process.exitCode = 1; });
