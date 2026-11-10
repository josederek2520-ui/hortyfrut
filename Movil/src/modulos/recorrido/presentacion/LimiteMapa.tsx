import { Component, type ReactNode } from "react";

export default class LimiteMapa extends Component<
  { children: ReactNode; alError: () => void },
  { fallo: boolean }
> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  componentDidCatch() {
    this.props.alError();
  }
  render() {
    return this.state.fallo ? null : this.props.children;
  }
}
