import { Hono } from "hono";
import { BoothAgent } from "./agents/booth";
import { HubAgent } from "./agents/hub";
import { FauxtoAgent } from "./agents/fauxto";
import { Backgrounder } from "./workflows/backgrounder";
import { Fauxtographer } from "./workflows/fauxtographer";
import { agentsMiddleware } from "hono-agents";
import { getCookie, setCookie } from "hono/cookie";

export { BoothAgent, HubAgent, FauxtoAgent, Backgrounder, Fauxtographer };

export type Vars = {
  userId: string;
};

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use(async (c, next) => {
  const path = c.req.path;
  if (path.startsWith("/api/images/")) {
    return await next();
  }
  let userId = getCookie(c, "userId");
  if (userId === undefined) {
    userId = crypto.randomUUID();
    console.log("User not found, generating new user: ", userId);
    setCookie(c, "userId", userId);
  }
  c.set("userId", userId);
  return await next();
});

// Note all image hosting going through here, including sharing uploads with Replicate
app.get("/api/images/*", async (c) => {
  const prefix = "/api/images/";
  const filename = c.req.path.replace(prefix, "");
  const obj = await c.env.Photos.get(filename);
  if (obj === null) {
    return c.notFound();
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  return c.body(obj.body, 200, { ...headers });
});

// Exposes /agents/<namespace>/<name> to onRequest
app.use("*", agentsMiddleware());

export default app;
