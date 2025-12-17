import { Agent } from "agents";

export type UserFauxto = {
  fauxtoId: string;
  filePath: string;
  boothName: string;
  boothDisplayName: string;
  createdAt: string;
};

type UserBooth = {
  boothName: string;
  boothDisplayName: string;
};

export type UserState = {
  userId: string;
  fauxtos: UserFauxto[];
  booths: UserBooth[];
};

export class UserAgent extends Agent<Env, UserState> {
  initialState = {
    userId: "",
    fauxtos: [],
    booths: [],
  };

  onStart() {
    if (!this.state.userId) {
      this.setState({
        ...this.state,
        userId: this.name,
      });
    }
  }

  private upsertBooth(payload: UserBooth) {
    const filtered = this.state.booths.filter(
      (booth) => booth.boothName !== payload.boothName
    );
    return [payload, ...filtered];
  }

  addFauxto(detail: UserFauxto) {
    const existing = this.state.fauxtos.filter(
      (fauxto) => fauxto.fauxtoId !== detail.fauxtoId
    );
    const booths = this.upsertBooth({
      boothName: detail.boothName,
      boothDisplayName: detail.boothDisplayName,
    });
    this.setState({
      ...this.state,
      userId: this.name,
      fauxtos: [detail, ...existing],
      booths,
    });
  }

  addBooth(payload: UserBooth) {
    const booths = this.upsertBooth(payload);
    this.setState({
      ...this.state,
      userId: this.name,
      booths,
    });
  }

  removeFauxto(fauxtoId: string) {
    const remaining = this.state.fauxtos.filter((fauxto) => fauxto.fauxtoId !== fauxtoId);
    if (remaining.length === this.state.fauxtos.length) {
      return;
    }
    this.setState({
      ...this.state,
      fauxtos: remaining,
    });
  }
}
