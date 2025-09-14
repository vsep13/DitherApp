import React, { createContext, useContext, useMemo, useState } from 'react';

type Toast = { id: number; message: string; kind?: 'info'|'success'|'error'; ttl?: number };
type ToastCtx = { push: (message: string, kind?: Toast['kind'], ttl?: number) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }){
  const [toasts, setToasts] = useState<Toast[]>([]);
  const api = useMemo<ToastCtx>(()=>({
    push(message, kind='info', ttl=3000){
      const id = Date.now() + Math.floor(Math.random()*1000);
      setToasts((t)=> [...t, { id, message, kind, ttl }]);
      window.setTimeout(()=> setToasts((t)=> t.filter(x=> x.id!==id)), ttl);
    }
  }),[]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed right-3 top-3 z-50 space-y-2">
        {toasts.map(t=> (
          <div key={t.id} className={`px-3 py-2 rounded text-sm border shadow ${
            t.kind==='error' ? 'bg-red-800/80 border-red-600 text-red-100' : t.kind==='success' ? 'bg-emerald-800/80 border-emerald-600 text-emerald-100' : 'bg-zinc-800/80 border-zinc-700 text-zinc-100'
          }`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(){
  const v = useContext(Ctx);
  if(!v) throw new Error('useToast must be used within <ToastProvider>');
  return v;
}

