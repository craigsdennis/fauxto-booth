import { Agent, callable } from "agents";

export type BoothState = {
    displayName: string;
    backgroundImageUrl: string;
}

export class BoothAgent extends Agent<Env, BoothState> {

    @callable()
    setup({displayName}: {displayName: string}) {
        // Update the state, auto broadcasts
        this.setState({
            ...this.state,
            displayName,
        })
    }
}