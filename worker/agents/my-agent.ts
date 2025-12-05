import { Agent, callable } from "agents";

export type PublicAgentState = {
    someValue: string;
    updateCount: number;
}

export class MyAgent extends Agent<Env, PublicAgentState> {
    initialState = {
        someValue: "Hi Mom!",
        updateCount: 0
    }

    @callable()
    updateSomeValue({someValue}: {someValue: string}) {
        // Update the state, auto broadcasts
        this.setState({
            ...this.state,
            someValue,
            updateCount: this.state.updateCount + 1
        })
    }
}