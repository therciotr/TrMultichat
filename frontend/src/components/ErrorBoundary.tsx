import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] UI crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "sans-serif" }}>
          <h2>Ops! Ocorreu um erro na tela.</h2>
          <p>Tente atualizar a página ou fazer login novamente.</p>
        </div>
      );
    }
    return this.props.children;
  }
}


