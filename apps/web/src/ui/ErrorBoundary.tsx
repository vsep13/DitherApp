import React from 'react';

type State = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }){
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any){
    // eslint-disable-next-line no-console
    console.error('App error boundary:', error, info);
  }
  render(){
    if(this.state.hasError){
      return (
        <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-xl border border-red-700 bg-red-900/20 rounded p-4">
            <div className="font-semibold text-red-300 mb-2">Something went wrong.</div>
            <div className="text-sm text-red-200 mb-3">{String(this.state.error||'Unknown error')}</div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={()=> location.reload()}>Reload</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

