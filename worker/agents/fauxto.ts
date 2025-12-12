import { Agent } from "agents";

export type FauxtoState = {
    filePath: string;
    members: string[];
    parentBoothName: string;
}

export class FauxtoAgent extends Agent<Env, FauxtoState> {
    initialState = {
        filePath: "",
        parentBoothName: "",
        members: []
    }

    setup({filePath, members, parentBoothName}: FauxtoState) {
        this.setState({
            ...this.state,
            filePath,
            members,
            parentBoothName
        })
    }
}