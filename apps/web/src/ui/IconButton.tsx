import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

export function IconButton({ label, onClick, children, variant='default' }: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'default'|'primary';
}){
  const base = 'w-9 h-9 grid place-items-center rounded outline-none focus-visible:ring-1 focus-visible:ring-sky-500';
  const cls = variant==='primary'
    ? `${base} bg-emerald-700 hover:bg-emerald-600`
    : `${base} bg-zinc-800 hover:bg-zinc-700 border border-zinc-700`;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button aria-label={label} className={cls} onClick={onClick}>
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content className="bg-zinc-800 text-zinc-100 px-2 py-1 rounded text-xs">
        {label}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

