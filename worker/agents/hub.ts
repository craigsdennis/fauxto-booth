import { Agent, callable, getAgentByName } from "agents";

export type BoothDetail = {
  name: string;
  displayName: string;
};

export type HubState = {
  latestBooths: BoothDetail[];
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
    hostName
  }: {
    displayName: string;
    description: string;
    hostName: string;
  }) {
    const boothSlug = await this.generateUniqueBoothSlug(displayName);
    const booth = await getAgentByName(this.env.BoothAgent, boothSlug);
    // Save the booth
    await booth.setup({ displayName, description, hostName });
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
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
}
