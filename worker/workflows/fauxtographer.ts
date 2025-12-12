import { getAgentByName } from "agents";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";

type FauxtographerParams = {
  agentName: string;
};

export class Fauxtographer extends WorkflowEntrypoint<
  Env,
  FauxtographerParams
> {
  async run(
    event: Readonly<WorkflowEvent<FauxtographerParams>>,
    step: WorkflowStep
  ) {
    const { agentName } = event.payload;
    const agent = await getAgentByName(this.env.BoothAgent, agentName);
    const fauxtoId = await step.do("Preparing next fauxto", async () => {
      return await agent.prepareFauxto({workflowInstanceId: event.instanceId});
    });
    const url = await step.do(`Generate fauxto ${fauxtoId}`, async () => {
      return await agent.generateFauxto({ fauxtoId });
    });
    const filePath = await step.do(`Store the fauxto for ${url}`, async () => {
      const filePath = `${agent.name}/fauxtos/${fauxtoId}.jpg`;
      await agent.storePhoto({ url, filePath });
      return filePath;
    });
    const fauxto = await step.do("Update fauxtos", async () => {
        return await agent.updateFauxto({fauxtoId, filePath});
    });

  }
}
