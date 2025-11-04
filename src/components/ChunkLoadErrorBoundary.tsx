import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorType: 'chunk' | 'other' | null;
}

export class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorType: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError = 
      error.message.includes('Loading chunk') ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('forwardRef') ||
      error.message.includes('createContext') ||
      error.message.includes('Cannot read properties of undefined');

    return {
      hasError: true,
      errorType: isChunkError ? 'chunk' : 'other'
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Chunk loading error:', error, errorInfo);
    
    if (this.state.errorType === 'chunk') {
      // Auto-retry após 2s
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }

  render() {
    if (this.state.hasError && this.state.errorType === 'chunk') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Carregando recursos...</h2>
            <p className="text-muted-foreground">A página será recarregada automaticamente</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
