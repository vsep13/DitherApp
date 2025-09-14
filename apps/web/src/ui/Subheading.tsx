import React from 'react';

export function Subheading({ children, className="" }: { children: React.ReactNode; className?: string }){
  return <div className={("text-xs uppercase tracking-wide text-zinc-500 mb-1 " + className).trim()}>{children}</div>;
}

