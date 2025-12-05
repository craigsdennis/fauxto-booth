import { Hono } from "hono";
import { MyAgent } from "./agents/my-agent";
import { agentsMiddleware } from "hono-agents";

// Export the agent
export { MyAgent };

const app = new Hono<{ Bindings: Env }>();

app.get("/api", async (c) => {
  return c.json({ example: "This is coming from the worker" });
});

app.use("*", agentsMiddleware());

export default app;
