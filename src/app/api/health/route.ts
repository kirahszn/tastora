// Health check endpoint. Returns a static payload only — never secrets or env values.

export function GET() {
  return Response.json({ status: "ok", service: "tastora" });
}
