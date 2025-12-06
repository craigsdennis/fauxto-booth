import { Hono } from "hono";
import { BoothAgent } from "./agents/booth";
import { agentsMiddleware } from "hono-agents";

export { BoothAgent };

const app = new Hono<{ Bindings: Env }>();

app.get("/api", async (c) => {
  return c.json({ example: "This is coming from the worker" });
});


// Exposes /agents/<namespace>/<name> to onRequest
app.use("*", agentsMiddleware());

export default app;
