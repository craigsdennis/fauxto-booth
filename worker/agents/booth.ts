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

    async onRequest(_request: Request): Promise<Response> {
        void _request;
        // TODO: get userId
        // TODO: process form upload, store in R2
        console.log("Hi mom");
        return new Response("Not implemented", { status: 501 });
    }
}
