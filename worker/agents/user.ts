import { Agent } from "agents";

export type UserFauxto = {
  fauxtoId: string;
  filePath: string;
  boothName: string;
  boothDisplayName: string;
  createdAt: string;
};

export type UserState = {
  userId: string;
  fauxtos: UserFauxto[];
};

export class UserAgent extends Agent<Env, UserState> {
  initialState = {
    userId: "",
    fauxtos: [],
  };

  onStart() {
    if (!this.state.userId) {
      this.setState({
        ...this.state,
        userId: this.name,
      });
    }
  }

  addFauxto(detail: UserFauxto) {
    const existing = this.state.fauxtos.filter((fauxto) => fauxto.fauxtoId !== detail.fauxtoId);
    this.setState({
      ...this.state,
      userId: this.name,
      fauxtos: [detail, ...existing],
    });
  }
}
