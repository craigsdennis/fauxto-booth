import { Agent, callable, getAgentByName } from "agents";
import type { BoothFauxtoRecord, BoothUploadRecord } from "./booth";

export type BoothDetail = {
  name: string;
  displayName: string;
};

export type HubState = {
  latestBooths: BoothDetail[];
};

export type HubFauxtoDetail = {
  boothName: string;
  boothDisplayName: string;
  fauxtos: BoothFauxtoRecord[];
};

export type HubUploadDetail = {
  boothName: string;
  boothDisplayName: string;
  uploads: BoothUploadRecord[];
};

export class HubAgent extends Agent<Env, HubState> {
  initialState = {
    latestBooths: [],
  };

  onStart() {
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS booths (
        slug TEXT PRIMARY KEY,
        displayName TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );`);
  }

  slugify(displayName: string): string {
    return displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async generateUniqueBoothSlug(displayName: string): Promise<string> {
    const base = this.slugify(displayName) || "booth";

    // Get all matching slugs: base, base-2, base-3, etc.
    const rows = this.sql<{ slug: string }>`
    SELECT slug
    FROM booths
    WHERE slug = ${base}
       OR slug LIKE ${base + "-%"}`;

    if (rows.length === 0) {
      return base;
    }
    const slugs = rows.map((r) => r.slug);
    const existing = new Set(slugs);

    // If plain base isn't taken, use it.
    if (!existing.has(base)) {
      return base;
    }

    // Look for the highest "-N" and increment
    let maxSuffix = 1;

    for (const slug of existing) {
      const match = slug.match(/^(.+)-(\d+)$/);
      if (!match) continue;

      const [, slugBase, numStr] = match;
      if (slugBase === base) {
        const num = parseInt(numStr, 10);
        if (!Number.isNaN(num) && num > maxSuffix) {
          maxSuffix = num;
        }
      }
    }

    return `${base}-${maxSuffix + 1}`;
  }

  @callable()
  async createBooth({
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
    const boothSlug = await this.generateUniqueBoothSlug(displayName);
    const booth = await getAgentByName(this.env.BoothAgent, boothSlug);
    // Save the booth
    await booth.setup({ displayName, description, hostName, idealMemberSize });
    this
      .sql`INSERT INTO booths (slug, displayName) VALUES (${boothSlug}, ${displayName});`;
    // Prepend the state
    const latestBooths = this.state.latestBooths;
    latestBooths.unshift({ name: boothSlug, displayName });
    this.setState({
      ...this.state,
      // 10 most recent
      latestBooths: latestBooths.slice(0, 10),
    });
    return boothSlug;
  }

  @callable()
  async allBoothSlugs(): Promise<string[]> {
    const rows = this.sql<{
      slug: string;
    }>`SELECT slug FROM booths ORDER BY createdAt DESC;`;
    return rows.map((row) => row.slug);
  }

  @callable()
  async allFauxtos(): Promise<HubFauxtoDetail[]> {
    const slugs = await this.allBoothSlugs();
    if (slugs.length === 0) {
      return [];
    }

    const perBoothRecords = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const booth = await getAgentByName(this.env.BoothAgent, slug);
          const state = await booth.state;
          const boothDisplayName = state.displayName || slug;
          const fauxtos = await booth.listAllFauxtos();
          return {
            boothName: slug,
            boothDisplayName,
            fauxtos: fauxtos ?? [],
          };
        } catch (error) {
          console.warn(`Failed to fetch fauxtos for booth ${slug}`, error);
          return {
            boothName: slug,
            boothDisplayName: slug,
            fauxtos: [],
          };
        }
      })
    );

    return perBoothRecords;
  }

  @callable()
  async deleteFauxto({ fauxtoId }: { fauxtoId: string }) {
    if (!fauxtoId) {
      throw new Error("A fauxto ID is required.");
    }
    const fauxtoAgent = await getAgentByName(this.env.FauxtoAgent, fauxtoId);
    await fauxtoAgent.delete();
    return true;
  }

  @callable()
  async allUploads(): Promise<HubUploadDetail[]> {
    const slugs = await this.allBoothSlugs();
    if (slugs.length === 0) {
      return [];
    }

    const perBoothUploads = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const booth = await getAgentByName(this.env.BoothAgent, slug);
          const state = await booth.state;
          const boothDisplayName = state.displayName || slug;
          const uploads = await booth.listUploads();
          return {
            boothName: slug,
            boothDisplayName,
            uploads: uploads ?? [],
          };
        } catch (error) {
          console.warn(`Failed to fetch uploads for booth ${slug}`, error);
          return {
            boothName: slug,
            boothDisplayName: slug,
            uploads: [],
          };
        }
      })
    );

    return perBoothUploads;
  }

  @callable()
  async deleteUpload({ boothSlug, uploadId }: { boothSlug: string; uploadId: number }) {
    if (!boothSlug) {
      throw new Error("A booth slug is required.");
    }
    const booth = await getAgentByName(this.env.BoothAgent, boothSlug);
    return booth.deleteUpload({ uploadId });
  }

  @callable()
  async deleteBooth({ boothSlug }: { boothSlug: string }) {
    if (!boothSlug) {
      throw new Error("A booth slug is required.");
    }
    const booth = await getAgentByName(this.env.BoothAgent, boothSlug);
    await booth.delete();
    this.sql`DELETE FROM booths WHERE slug = ${boothSlug};`;
    this.setState({
      ...this.state,
      latestBooths: this.state.latestBooths.filter(
        (boothDetail) => boothDetail.name !== boothSlug,
      ),
    });
    return true;
  }
}
