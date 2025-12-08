import { Agent } from "agents";

export type BoothState = {
    displayName: string;
    description: string;
    backgroundImageUrl: string;
}

export class BoothAgent extends Agent<Env, BoothState> {

    initialState = {
        displayName: "",
        description: "",
        backgroundImageUrl: ""
    };

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
