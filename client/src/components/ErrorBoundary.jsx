import { Component } from 'react';

/** Se uma tela quebrar, mostra um aviso em vez de deixar tudo branco. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Erro na tela:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h2>Esta tela teve um problema</h2>
        <p className="muted">O resto do sistema continua funcionando. Volte para a página anterior ou recarregue.</p>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => (window.history.back(), this.setState({ error: null }))}>
            Voltar
          </button>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
        <code>{String(this.state.error?.message || this.state.error)}</code>
      </div>
    );
  }
}
