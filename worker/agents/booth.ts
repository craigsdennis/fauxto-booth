import { Agent, callable } from "agents";

export type BoothState = {
    displayName: string;
    description: string;
    backgroundImageUrl: string;
}

export class BoothAgent extends Agent<Env, BoothState> {

    setup({displayName, description}: {displayName: string, description: string}) {
        // TODO: Generate the background
        // Update the state, auto broadcasts
        this.setState({
            ...this.state,
            displayName,
            description
        })
    }
}