import { Agent, callable, getAgentByName } from "agents";
import { env } from "cloudflare:workers";
import Replicate from "replicate";

type Upload = {
  id: number;
  postedByUserId: string;
  filePath: string;
};

export type FauxtoDetail = {
  fauxtoId: string;
  filePath: string;
};

export type BoothFauxtoRecord = {
  boothName: string;
  boothDisplayName: string;
  fauxtoId: string;
  filePath: string | null;
  createdAt: string;
};

export type BoothUploadRecord = {
  id: number;
  filePath: string;
  postedByUserId: string;
  createdAt: string;
};

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
  inProgressFauxtoCount: number;
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
    inProgressFauxtoCount: 0,
    latestFauxtos: [],
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
    idealMemberSize,
  }: {
    displayName: string;
    description: string;
    hostName: string;
    idealMemberSize: number;
  }) {
    // Update the state, auto broadcasts
    this.setState({
      ...this.state,
      displayName,
      description,
      hostName,
      idealMemberSize,
    });
    await this.refreshBackground();
  }

  awaitingUploaderCount() {
    const [row] = this.sql<{
      totalUploaders: number;
      usersWithFauxto: number;
    }>`SELECT
      COUNT(DISTINCT u.postedByUserId) AS totalUploaders,
      COUNT(DISTINCT fm.memberUserId) AS usersWithFauxto
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
      prompt: `The background of a photo that is about ready to have people pose. There should be no people in it currently. Make it look like: ${this.state.description}`,
      aspect_ratio: "16:9",
    };
    const output = await replicate.run("bytedance/seedream-4.5", { input });
    // @ts-expect-error - Not the right type currrently
    const url = output[0].url();
    console.log({ backgroundReplicateUrl: url });
    return url.href;
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
    // If we don't yet have the ideal amount of folks
    if (awaiting < this.state.idealMemberSize) {
      const since = this.msSinceLastFauxto();
      // First fauxto in this booth, we should make them wait, no matter what
      if (since === -1) {
        this.updateDisplayStatus({
          displayStatus: `Invite more people to upload their photo, missing ${this.state.idealMemberSize - awaiting}`,
        });
        return;
      }
      if (!reshoot) {
        console.warn(
          `Only ${awaiting} awaiting, want ${this.state.idealMemberSize}.`
        );
        this.updateDisplayStatus({ displayStatus: `Waiting for ${this.state.idealMemberSize - awaiting} more. Share it with friends` });
        // ...schedule a call in 2 minutes to try again
        const scheduled = this.getSchedules().some(
          (s) => s.callback === "snapFauxto"
        );
        if (!scheduled) {
          console.log("Scheduling a reshoot in 2 minutes");
          await this.schedule(120, "snapFauxto", { reshoot: true });
        }
        return;
      }
    }
    this.updateDisplayStatus({ displayStatus: `📸 Snapping fauxtos` });
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
    this.sql`UPDATE fauxtos SET filePath=${filePath} WHERE id=${fauxtoId}`;
    const rows = this.sql<{
      memberUserId: string;
    }>`SELECT memberUserId FROM fauxto_members WHERE fauxtoId = ${fauxtoId}`;
    const members = rows.map((r) => r.memberUserId);
    const fauxtoAgent = await getAgentByName(this.env.FauxtoAgent, fauxtoId);
    await fauxtoAgent.setup({ filePath, members, parentBoothName: this.name });
    this.setState({
      ...this.state,
      fauxtoCount: this.state.fauxtoCount + 1,
    });

    // Prepend the state
    const latestFauxtos = this.state.latestFauxtos;
    latestFauxtos.unshift({ fauxtoId, filePath });
    this.setState({
      ...this.state,
      // 10 most recent
      latestFauxtos: latestFauxtos.slice(0, 20),
    });

    if (members.length > 0) {
      const boothDisplayName = this.state.displayName || this.name;
      const createdAt = new Date().toISOString();
      await Promise.all(
        members.map(async (memberId) => {
          try {
            console.log(`Getting user with name ${memberId}`);
            const userAgent = await getAgentByName(
              this.env.UserAgent,
              memberId
            );
            await userAgent.addFauxto({
              fauxtoId,
              filePath,
              boothName: this.name,
              boothDisplayName,
              createdAt,
            });
          } catch (error) {
            console.warn("Failed to update user agent", { memberId, error });
          }
        })
      );
    }
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

    this
      .sql`INSERT INTO fauxtos (id, workflowInstanceId) VALUES (${fauxtoId}, ${workflowInstanceId})`;
    for (const upload of uploads) {
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
    // const [backgroundMarker, ...peopleMarkers] = image_input.map((_, index) => `image_${index}`);
    const input = {
      size: "2K",
      prompt: `Using the first photo as the backdrop and then add the people from the remaining images to the main photograph. 
        Make their outfits and expressions match what might happen in a photo booth that has been described to be: ${this.state.description}
        `,
      aspect_ratio: "16:9",
      image_input,
    };
    const output = await replicate.run("bytedance/seedream-4.5", { input });
    // @ts-expect-error - Not the right type atm
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
WITH
-- Per-user: how many distinct fauxtos they've appeared in,
-- and how long they've been waiting (oldest upload timestamp).
user_stats AS (
  SELECT
    u.postedByUserId,
    COUNT(DISTINCT fm.fauxtoId) AS userFauxtoCount,
    MIN(u.createdAt)            AS oldestUploadCreatedAt
  FROM uploads u
  LEFT JOIN fauxto_members fm ON fm.uploadId = u.id
  GROUP BY u.postedByUserId
),

-- Per-upload: how many times each upload has been used.
upload_usage AS (
  SELECT
    u.id,
    u.postedByUserId,
    u.filePath,
    u.createdAt,
    COUNT(fm.id) AS uploadUsageCount
  FROM uploads u
  LEFT JOIN fauxto_members fm ON fm.uploadId = u.id
  GROUP BY u.id
),

-- Pick ONE upload per user (their "best" candidate upload),
-- with random tie-breaks inside each user.
ranked AS (
  SELECT
    uu.*,
    us.userFauxtoCount,
    us.oldestUploadCreatedAt,
    ROW_NUMBER() OVER (
      PARTITION BY uu.postedByUserId
      ORDER BY uu.uploadUsageCount ASC, uu.createdAt ASC, RANDOM()
    ) AS rn
  FROM upload_usage uu
  JOIN user_stats us ON us.postedByUserId = uu.postedByUserId
)

SELECT
  id,
  postedByUserId,
  filePath,
  createdAt,
  uploadUsageCount,
  userFauxtoCount,
  oldestUploadCreatedAt
FROM ranked
WHERE rn = 1
ORDER BY
  userFauxtoCount ASC,          -- least in fauxtos first
  oldestUploadCreatedAt ASC,    -- waiting longest first
  RANDOM()                      -- randomize true ties;
LIMIT ${limit};
`;
    if (!results || results.length === 0) {
      return [];
    }

    return results;
  }

  @callable()
  async listUploads(): Promise<BoothUploadRecord[]> {
    const rows = this.sql<{
      id: number;
      filePath: string;
      postedByUserId: string;
      createdAt: string;
    }>`SELECT id, filePath, postedByUserId, createdAt FROM uploads ORDER BY createdAt DESC;`;
    return rows.map((row) => ({
      id: row.id,
      filePath: row.filePath,
      postedByUserId: row.postedByUserId,
      createdAt: row.createdAt,
    }));
  }

  @callable()
  async listAllFauxtos(): Promise<BoothFauxtoRecord[]> {
    const rows = this.sql<{
      id: string;
      filePath: string | null;
      createdAt: string;
    }>`SELECT id, filePath, createdAt FROM fauxtos ORDER BY createdAt DESC;`;
    const boothDisplayName = this.state.displayName || this.name;
    return rows.map((row) => ({
      boothName: this.name,
      boothDisplayName,
      fauxtoId: row.id,
      filePath: row.filePath ?? null,
      createdAt: row.createdAt,
    }));
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
    const existing = this.sql<{
      total: number;
    }>`SELECT COUNT(*) as total FROM uploads WHERE postedByUserId = ${userId};`;
    const total = existing[0]?.total ?? 0;
    if (total > 0) {
      const sharePath = `/share/booths/${encodeURIComponent(this.name)}`;
      return Response.json(
        {
          success: false,
          reason: "duplicate-upload",
          message:
            "You already uploaded to this booth. Share the booth link to invite friends.",
          sharePath,
        },
        { status: 409 }
      );
    }
    const uploadFileName = `${this.name}/uploads/${userId}/${file.name}`;
    const transformed = await this.env.Images.input(file.stream())
      .transform({gravity: "face", zoom: 0.9})
      .output({
        format: "image/jpeg",
      });
    const response = transformed.response();

    const transformedBuffer = await response.arrayBuffer();

    await this.env.Photos.put(uploadFileName, transformedBuffer, {
      httpMetadata: { contentType: transformed.contentType() },
    });
    this
      .sql`INSERT INTO uploads (postedByUserId, filePath) VALUES (${userId}, ${uploadFileName});`;
    this.setState({
      ...this.state,
      uploadedCount: this.state.uploadedCount + 1,
    });
    try {
      const userAgent = await getAgentByName(this.env.UserAgent, userId);
      await userAgent.addBooth({
        boothName: this.name,
        boothDisplayName: this.state.displayName || this.name,
      });
    } catch (error) {
      console.warn("Failed to update user agent with booth upload", {
        userId,
        boothName: this.name,
        error,
      });
    }
    await this.snapFauxto({ reshoot: false });
    return Response.json({ success: true, uploadFileName });
  }

  @callable()
  async reshoot() {
    return await this.snapFauxto({ reshoot: true });
  }

  changeInProgressFauxtoCount({ by }: { by: number }) {
    this.setState({
      ...this.state,
      inProgressFauxtoCount: this.state.inProgressFauxtoCount + by,
    });
    if (this.state.inProgressFauxtoCount === 0) {
      this.updateDisplayStatus({
        displayStatus:
          "Upload more selfies, or press the reshoot button to capture more fauxtos",
      });
    }
  }

  async removeFauxto({ fauxtoId }: { fauxtoId: string }) {
    this.sql`DELETE FROM fauxto_members WHERE fauxtoId = ${fauxtoId};`;
    this.sql`DELETE FROM fauxtos WHERE id = ${fauxtoId};`;
    const latestFauxtos = this.state.latestFauxtos.filter(
      (fauxto) => fauxto.fauxtoId !== fauxtoId
    );
    const [{ total }] = this.sql<{
      total: number;
    }>`SELECT COUNT(*) as total FROM fauxtos;`;
    this.setState({
      ...this.state,
      latestFauxtos,
      fauxtoCount: total,
    });
    return true;
  }

  @callable()
  async setIdealMemberSize({ idealMemberSize }: { idealMemberSize: number }) {
    const size = Math.max(1, Math.min(Math.round(idealMemberSize), 10));
    this.setState({
      ...this.state,
      idealMemberSize: size,
    });
    // Side effect, run a test to see if we can get folks
    await this.snapFauxto({ reshoot: false });
    return size;
  }

  @callable()
  async hasUserUpload({ userId }: { userId: string }) {
    if (!userId) {
      return false;
    }
    const rows = this.sql<{
      total: number;
    }>`SELECT COUNT(*) as total FROM uploads WHERE postedByUserId = ${userId};`;
    const total = rows[0]?.total ?? 0;
    return total > 0;
  }

  @callable()
  async deleteUpload({
    uploadId,
  }: {
    uploadId: number;
  }): Promise<{ deletedFauxtoIds: string[] }> {
    const rows = this.sql<{
      id: number;
      filePath: string;
    }>`SELECT id, filePath FROM uploads WHERE id = ${uploadId} LIMIT 1;`;
    const upload = rows[0];
    if (!upload) {
      throw new Error("Upload not found.");
    }

    const fauxtoRows = this.sql<{
      fauxtoId: string;
    }>`SELECT DISTINCT fauxtoId FROM fauxto_members WHERE uploadId = ${uploadId};`;
    const deletedFauxtoIds: string[] = [];
    for (const { fauxtoId } of fauxtoRows) {
      try {
        const fauxtoAgent = await getAgentByName(
          this.env.FauxtoAgent,
          fauxtoId
        );
        await fauxtoAgent.delete();
        deletedFauxtoIds.push(fauxtoId);
      } catch (error) {
        console.warn(
          `Failed to delete fauxto ${fauxtoId} while removing upload ${uploadId}`,
          error
        );
      }
    }

    this.sql`DELETE FROM fauxto_members WHERE uploadId = ${uploadId};`;
    this.sql`DELETE FROM uploads WHERE id = ${uploadId};`;

    if (upload.filePath) {
      try {
        await this.env.Photos.delete(upload.filePath);
      } catch (error) {
        console.warn(`Failed to delete upload file ${upload.filePath}`, error);
      }
    }

    const [{ total }] = this.sql<{
      total: number;
    }>`SELECT COUNT(*) as total FROM uploads;`;
    this.setState({
      ...this.state,
      uploadedCount: total,
    });

    return { deletedFauxtoIds };
  }

  @callable()
  async delete() {
    const fauxtoRows = this.sql<{ id: string }>`SELECT id FROM fauxtos;`;
    for (const { id } of fauxtoRows) {
      try {
        const fauxto = await getAgentByName(this.env.FauxtoAgent, id);
        await fauxto.delete();
      } catch (error) {
        console.warn(
          `Failed to delete fauxto ${id} while deleting booth ${this.name}`,
          error
        );
      }
    }

    const uploadRows = this.sql<{
      filePath: string;
    }>`SELECT filePath FROM uploads;`;
    await Promise.all(
      uploadRows.map(async ({ filePath }) => {
        try {
          await this.env.Photos.delete(filePath);
        } catch (error) {
          console.warn(
            `Failed to delete upload ${filePath} while deleting booth ${this.name}`,
            error
          );
        }
      })
    );
    this.sql`DELETE FROM uploads;`;

    if (this.state.backgroundFilePath) {
      try {
        await this.env.Photos.delete(this.state.backgroundFilePath);
      } catch (error) {
        console.warn(
          `Failed to delete background ${this.state.backgroundFilePath} for booth ${this.name}`,
          error
        );
      }
    }

    return this.destroy();
  }
}
