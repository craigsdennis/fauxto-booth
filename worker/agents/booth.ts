import {
  Agent,
  callable,
  getAgentByName,
  type Connection,
  type ConnectionContext,
} from "agents";
import { env } from "cloudflare:workers";
import Replicate from "replicate";

type Upload = {
  id: number;
  postedByUserId: string;
  filePath: string;
};

export type FauxtoDetail = {
  fauxtoId: string,
  filePath: string,
}

export type BoothState = {
  displayName: string;
  description: string;
  backgroundFilePath?: string;
  backgroundImageStatus?: "ready" | "generating";
  uploadedCount: number;
  idealMemberSize: number;
  hostName?: string;
  displayStatus: string;
  fauxtoCount: number;
  latestFauxtos: FauxtoDetail[];
};

export class BoothAgent extends Agent<Env, BoothState> {
  initialState = {
    displayName: "",
    description: "",
    displayStatus: "Scan the QR code to get started",
    uploadedCount: 0,
    idealMemberSize: 2,
    fauxtoCount: 0,
    latestFauxtos: []
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
        filePath TEXT,
        workflowInstanceId TEXT,
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
    hostName,
  }: {
    displayName: string;
    description: string;
    hostName: string;
  }) {
    // Update the state, auto broadcasts
    this.setState({
      ...this.state,
      displayName,
      description,
      hostName,
    });
    await this.refreshBackground();
  }

  awaitingUploaderCount() {
    const [row] = this.sql<{
      totalUploaders: number;
      usersWithFauxto: number;
    }>`SELECT
      COUNT(DISTINCT u.postedByUserId) AS totalUploaders,
      COUNT(DISTINCT fm.memberUserId)AS usersWithFauxto
    FROM uploads u
    LEFT JOIN fauxto_members fm
    ON fm.memberUserId = u.postedByUserId;`;
    return row.totalUploaders - row.usersWithFauxto;
  }

  @callable()
  async refreshBackground() {
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

  getConnectionTags(
    _connection: Connection,
    context: ConnectionContext
  ): string[] | Promise<string[]> {
    const cookie = context.request.headers.get("Cookie");
    if (!cookie) return [];

    // Extract a specific cookie
    const cookies = Object.fromEntries(
      cookie.split(";").map((c) => c.trim().split("="))
    );

    return [cookies.userId];
  }

  updateDisplayStatus({ displayStatus }: { displayStatus: string }) {
    this.setState({
      ...this.state,
      displayStatus,
    });
  }

  msSinceLastFauxto() {
    const [row] = this.sql<{ createdAt: string }>`SELECT createdAt
      FROM fauxtos
      ORDER BY createdAt DESC
      LIMIT 1`;
    if (row === undefined) {
      return -1;
    }
    const lastCreatedAt = row.createdAt;
    const lastCreatedAtMs = Date.parse(lastCreatedAt);
    const nowMs = Date.now();
    return nowMs - lastCreatedAtMs;
  }

  async snapFauxto({ reshoot = false }: { reshoot: boolean }) {
    const awaiting = this.awaitingUploaderCount();
    if (awaiting <= 0 && !reshoot) {
      console.warn(
        "All uploaders already captured, set reshoot to true to snap"
      );
      return;
    }
    // If we don't yet have the ideal amount of folks
    if (awaiting < this.state.idealMemberSize) {
      // ... and less than 30 seconds have passed since the last snap.
      const since = this.msSinceLastFauxto();
      // First time
      if (since === -1) {
        this.updateDisplayStatus({
          displayStatus: `Invite more people to upload their photo, missing ${this.state.idealMemberSize - awaiting}`,
        });
        return;
      }
      if (since < 30000) {
        console.warn(
          `Only ${awaiting} awaiting, want ${this.state.idealMemberSize}.`
        );
        this.updateDisplayStatus({displayStatus: "Waiting for a few more"});
        // ...schedule a call in 10 seconds to try again
        const scheduled = this.getSchedules().some(
          (s) => s.callback === "snapFauxto"
        );
        if (!scheduled) {
          console.log("Scheduling a retry in 10 seconds");
          await this.schedule(10, "snapFauxto", { reshoot: false });
        }
        return;
      }
    }
    this.updateDisplayStatus({displayStatus: "You look great! Creating Fauxto"})
    await this.env.Fauxtographer.create({
      params: {
        agentName: this.name,
      },
    });
  }

  async updateFauxto({
    fauxtoId,
    filePath,
  }: {
    fauxtoId: string;
    filePath: string;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.sql`UPDATE fauxtos SET filePath=${filePath} WHERE id=${fauxtoId}`;
    const rows = this.sql<{
      memberUserId: string;
    }>`SELECT memberUserId FROM fauxto_members WHERE id = ${fauxtoId}`;
    const members = rows.map((r) => r.memberUserId);
    const fauxtoAgent = await getAgentByName(this.env.FauxtoAgent, fauxtoId);
    await fauxtoAgent.setup({ filePath, members, parentBoothName: this.name });
    this.setState({
      ...this.state,
      fauxtoCount: this.state.fauxtoCount + 1,
    });
    // Broadcast to members of the Fauxto
    for (const member of members) {
      for (const conn of this.getConnections(member)) {
        conn.send(JSON.stringify({
          type: "fauxtoReady",
          fauxtoId,
          filePath
        }));
      }
    }

        // Prepend the state
    const latestFauxtos = this.state.latestFauxtos;
    latestFauxtos.unshift({ fauxtoId, filePath });
    this.setState({
      ...this.state,
      // 10 most recent
      latestFauxtos: latestFauxtos.slice(0, 20),
    });

  }

  // Reserves the current fauxto members
  prepareFauxto({
    workflowInstanceId = null,
  }: {
    workflowInstanceId: string | null;
  }) {
    const fauxtoId = crypto.randomUUID();
    const uploads = this.getSuggestedUploads({
      limit: this.state.idealMemberSize,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this
      .sql`INSERT INTO fauxtos (id, workflowInstanceId) VALUES (${fauxtoId}, ${workflowInstanceId})`;
    for (const upload of uploads) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      this
        .sql`INSERT INTO fauxto_members (fauxtoId, uploadId, memberUserId) VALUES (${fauxtoId}, ${upload.id}, ${upload.postedByUserId})`;
    }
    return fauxtoId;
  }

  async generateFauxto({ fauxtoId }: { fauxtoId: string }) {
    const replicate = new Replicate({
      auth: env.REPLICATE_API_TOKEN,
    });
    if (this.state.backgroundFilePath === undefined) {
      throw new Error("Set background file path first");
    }
    const backgroundImage = await this.env.Photos.get(
      this.state.backgroundFilePath
    );
    if (backgroundImage === null) {
      return new Error("Couldn't find " + this.state.backgroundFilePath);
    }
    const rows = this.sql<{ filePath: string }>`SELECT u.filePath
        FROM fauxto_members fm
        JOIN uploads u ON u.id = fm.uploadId
        WHERE fm.fauxtoId = ${fauxtoId}
        ORDER BY fm.id ASC;`;
    // TODO: Implement face magnet and make images smaller for uploads?

    const HOST = this.state.hostName;
    const urls = rows.map((row) => {
      return `https://${HOST}/api/images/${row.filePath}`;
    });
    const image_input = [
      `https://${HOST}/api/images/${this.state.backgroundFilePath}`,
      ...urls,
    ];
    console.log({ image_input });
    const input = {
      size: "4K",
      prompt: `Using the backdrop of image_0 and then add all the people from the remaining images to the photo. 
        Make the outfit and expressions match what might happen in a photobooth that: ${this.state.description}
        `,
      aspect_ratio: "16:9",
      image_input,
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

  getSuggestedUploads({ limit }: { limit: number }): Upload[] {
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
    if (request.method !== "POST") {
      // Right?
      return new Response("Nothing to see here", { status: 404 });
    }
    const form = await request.formData();
    const file = form.get("selfie");
    const userId = form.get("userId") as string;
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
    this.setState({
      ...this.state,
      uploadedCount: this.state.uploadedCount + 1,
    });
    await this.snapFauxto({ reshoot: false });
    return Response.json({ success: true, uploadFileName });
  }
}
