"use client";
import { Component, type ReactNode } from "react";
export default class LimiteMapaChofer extends Component<
  { children: ReactNode; respaldo: ReactNode },
  { fallo: boolean }
> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? this.props.respaldo : this.props.children;
  }
}
