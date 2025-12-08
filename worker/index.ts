import { Hono } from "hono";
import { BoothAgent } from "./agents/booth";
import { HubAgent } from "./agents/hub";
import { agentsMiddleware } from "hono-agents";
import { getCookie, setCookie } from "hono/cookie";

export { BoothAgent, HubAgent };

export type Vars = {
  userId: string;
}

const app = new Hono<{ Bindings: Env, Variables: Vars }>();

app.use(async (c, next) => {
  // Ensure c.var.userId is set
  let userId = getCookie(c, "userId");
  if (userId === undefined) {
    userId = crypto.randomUUID();
    console.log("User not found, generating new user: ", userId);
    setCookie(c, "userId", userId);
  }
  c.set("userId", userId);
  await next();
});

app.get("/api", async (c) => {
  return c.json({ example: "This is coming from the worker" });
});


// Exposes /agents/<namespace>/<name> to onRequest
app.use("*", agentsMiddleware());

export default app;
