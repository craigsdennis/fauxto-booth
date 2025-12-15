import { Hono } from "hono";
import { getAgentByName } from "agents";
import { BoothAgent } from "./agents/booth";
import { HubAgent } from "./agents/hub";
import { FauxtoAgent } from "./agents/fauxto";
import { UserAgent } from "./agents/user";
import { Backgrounder } from "./workflows/backgrounder";
import { Fauxtographer } from "./workflows/fauxtographer";
import { agentsMiddleware } from "hono-agents";
import { getCookie, setCookie } from "hono/cookie";

export { BoothAgent, HubAgent, FauxtoAgent, UserAgent, Backgrounder, Fauxtographer };

export type Vars = {
  userId: string;
};

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.use(async (c, next) => {
  const path = c.req.path;
  // API calls to get the image or the OG pages don't need userIds
  if (path.startsWith("/api/images/") || path.startsWith("/share/")) {
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


app.get('/share/fauxtos/:id', async (c) => {
  const fauxtoId = c.req.param('id');
  try {
    const fauxtoAgent = await getAgentByName(c.env.FauxtoAgent, fauxtoId);
    const state = await fauxtoAgent.state;
    const url = new URL(c.req.url);
    const origin = `${url.protocol}//${url.host}`;
    const canonical = `${origin}/fauxtos/${encodeURIComponent(fauxtoId)}`;
    const imageUrl = state.filePath ? `${origin}/api/images/${state.filePath}` : null;
    const parentBoothName = state.parentBoothName; 
    let boothTitle = parentBoothName || 'Fauxto Booth';
    if (parentBoothName) {
      try {
        const boothAgent = await getAgentByName(c.env.BoothAgent, parentBoothName);
        const displayName = await boothAgent.state.displayName;
        boothTitle = displayName || parentBoothName;
      } catch (error) {
        console.warn('Unable to load booth agent for share view', error);
      }
    }
    const description = imageUrl ? `Come take a fake photo with me.` : 'Stay tuned for the finished Fauxto.';
    const twitterCard = imageUrl ? 'summary_large_image' : 'summary';
    const siteName = "Fauxto Booth";
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${boothTitle}</title>
    <link rel="canonical" href="${canonical}" />
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${boothTitle}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${siteName}" />
    ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
    ${imageUrl ? `<meta property="og:image:alt" content="${description}" />` : ''}
    <meta name="twitter:title" content="${boothTitle}" />
    <meta name="twitter:description" content="${description}" />
    ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
    <meta name="twitter:card" content="${twitterCard}" />
    <meta http-equiv="refresh" content="0; url=${canonical}" />
  </head>
  <body>
    <p>Redirecting to your Fauxto...</p>
  </body>
</html>`;
    return c.html(html);
  } catch (error) {
    console.error('Share view error', error);
    return c.notFound();
  }
});

export default app;
