import { Agent, callable, getAgentByName } from "agents";

export type FauxtoState = {
  filePath: string;
  members: string[];
  parentBoothName: string;
};

export class FauxtoAgent extends Agent<Env, FauxtoState> {
  initialState = {
    filePath: "",
    parentBoothName: "",
    members: [],
  };

  setup({ filePath, members, parentBoothName }: FauxtoState) {
    this.setState({
      ...this.state,
      filePath,
      members,
      parentBoothName,
    });
  }

  @callable()
  async delete() {
    if (this.state.filePath) {
      try {
        await this.env.Photos.delete(this.state.filePath);
      } catch (error) {
        console.warn(`Failed to delete R2 object for ${this.name}`, error);
      }
    }

    const memberIds = this.state.members || [];
    await Promise.all(
      memberIds.map(async (memberId) => {
        try {
          const userAgent = await getAgentByName(this.env.UserAgent, memberId);
          await userAgent.removeFauxto(this.name);
        } catch (error) {
          console.warn(
            `Failed to remove fauxto ${this.name} for user ${memberId}`,
            error,
          );
        }
      }),
    );

    if (this.state.parentBoothName) {
      try {
        const boothAgent = await getAgentByName(
          this.env.BoothAgent,
          this.state.parentBoothName,
        );
        await boothAgent.removeFauxto({ fauxtoId: this.name });
      } catch (error) {
        console.warn(
          `Failed to notify booth ${this.state.parentBoothName} about deletion of ${this.name}`,
          error,
        );
      }
    }
    // Will thow an error, it's okay
    return this.destroy();
  }
}
