import type { ComponentType, ReactNode } from 'react';

export type PageFact = { value: string; label: string; tone?: 'warn' | 'good' };

type Props = {
  title: string;
  description?: string | undefined;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }> | undefined;
  actions?: ReactNode;
};

export function PageHeaderTitle({ title, description, icon: Icon, actions }: Props) {
  return (
    <div className="page-header-row">
      <div className="page-header-text">
        {Icon ? (
          <span className="page-header-icon" aria-hidden="true">
            <Icon size={22} strokeWidth={1.6} />
          </span>
        ) : null}
        <div className="page-header-title">
          <h1>{title}</h1>
          {description ? <p className="page-header-sub">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}
