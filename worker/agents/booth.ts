import { Agent, callable } from "agents";
import { env } from "cloudflare:workers";
import Replicate from "replicate";

type Upload = {
  id: number;
  postedByUserId: string;
  filePath: string;
};

export type BoothState = {
  displayName: string;
  description: string;
  backgroundFilePath?: string;
  backgroundImageStatus?: "ready" | "generating";
};

export class BoothAgent extends Agent<Env, BoothState> {
  initialState = {
    displayName: "",
    description: "",
  };

  onStart() {
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        postedByUserId TEXT NOT NULL,
        filePath TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );`);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS fauxtos (
        id TEXT PRIMARY KEY,
        filePath TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );`);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS fauxto_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fauxtoId TEXT NOT NULL,
        uploadId INTEGER NOT NULL,
        memberUserId TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),

        FOREIGN KEY (fauxtoId) REFERENCES fauxtos(id) ON DELETE CASCADE,
        FOREIGN KEY (uploadId) REFERENCES uploads(id) ON DELETE CASCADE,

        UNIQUE (fauxtoId, uploadId),
        UNIQUE (fauxtoId, memberUserId)
        );`);
  }

  async setup({
    displayName,
    description,
  }: {
    displayName: string;
    description: string;
  }) {
    // Update the state, auto broadcasts
    this.setState({
      ...this.state,
      displayName,
      description,
    });
    await this.refreshBackground();
  }

  @callable()
  async refreshBackground() {
    // Workflow
    this.setState({
      ...this.state,
      backgroundImageStatus: "generating",
    });
    await this.env.Backgrounder.create({
      params: {
        agentName: this.name,
      },
    });
  }

  async setBackgroundImage({ filePath }: { filePath: string }) {
    this.setState({
      ...this.state,
      backgroundFilePath: filePath,
    });
    this.setState({
      ...this.state,
      backgroundImageStatus: "ready",
    });

    return true;
  }

  async generateBackground() {
    const replicate = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
    });
    const input = {
      size: "4K",
      prompt: `A photo shoot setup or stage that is set to look like. There should be no people in it currently: ${this.state.description}`,
      aspect_ratio: "16:9",
    };
    const output = await replicate.run("bytedance/seedream-4.5", { input });
    const url = output[0].url();
    console.log({ url });
    return url.href;
  }

  async storePhoto({ url, filePath }: { url: string; filePath: string }) {
    const response = await fetch(url);

    await this.env.Photos.put(filePath, response.body, {
      httpMetadata: {
        contentType: response.type,
      },
    });
    return filePath;
  }

  getSuggestedUploads({ limit }: { limit: number }) {
    const results = this.sql<Upload>`
      SELECT
        u.id,
        u.postedByUserId,
        u.filePath,
        u.createdAt,
        COUNT(fm.id) AS usageCount
      FROM uploads u
      LEFT JOIN fauxto_members fm ON fm.uploadId = u.id
      GROUP BY u.id
      ORDER BY usageCount ASC, u.createdAt ASC`;
    if (!results || results.length === 0) {
      return [];
    }
    const uploads: Upload[] = [];
    const seenUsers = new Set<string>();

    for (const row of results) {
      if (uploads.length >= limit) break;

      // Skip if we've already picked this user in this batch
      if (seenUsers.has(row.postedByUserId)) continue;

      seenUsers.add(row.postedByUserId);
      uploads.push(row);
    }

    return uploads;
  }

  async onRequest(request: Request): Promise<Response> {
    const cookie = request.headers.get("Cookie");
    if (!cookie) return new Response("no cookies");

    // Extract a specific cookie
    const cookies = Object.fromEntries(
      cookie.split(";").map((c) => c.trim().split("="))
    );
    const userId = cookies.userId;
    const form = await request.formData();
    const file = form.get("selfie");
    if (!(file instanceof File)) {
      return new Response("No file field named 'file'", { status: 400 });
    }
    const uploadFileName = `${this.name}/uploads/${userId}/${file.name}`;
    await this.env.Photos.put(uploadFileName, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this
      .sql`INSERT INTO uploads (postedByUserId, filePath) VALUES (${userId}, ${uploadFileName});`;
    return Response.json({ success: true, uploadFileName });
  }
}
