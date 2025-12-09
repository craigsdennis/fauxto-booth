import { getAgentByName } from "agents";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";

type BackgrounderParams = {
  agentName: string;
};

export class Backgrounder extends WorkflowEntrypoint<Env, BackgrounderParams> {
  async run(
    event: Readonly<WorkflowEvent<BackgrounderParams>>,
    step: WorkflowStep
  ) {
    const { agentName } = event.payload;
    const agent = await getAgentByName(this.env.BoothAgent, agentName);
    const url = await step.do("Generate the background", async() => {
        return await agent.generateBackground();
    });
    const filePath = await step.do(`Store the generation for ${url}`, async() => {
        const bgId = crypto.randomUUID();
        const filePath = `${agent.name}/backgrounds/${bgId}.jpg`;
        await agent.storePhoto({url, filePath });
        return filePath;
    });
    // TODO: Human in the loop here
    await step.do("Update booth background", async() => {
      return await agent.setBackgroundImage({filePath});
    });
    return `Updated booth background to ${filePath}`;
  }
}
