import { useState } from 'react';

export default function PasswordInput({ className, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-input-wrap">
      <input {...props} className={className} type={visible ? 'text' : 'password'} />
      <button
        className="password-visibility-toggle"
        type="button"
        aria-label={visible ? 'Itago ang password' : 'Ipakita ang password'}
        aria-pressed={visible}
        title={visible ? 'Itago ang password' : 'Ipakita ang password'}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.1 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C4.1 7.6 2.9 9.6 2.5 12c1 2.9 4.5 7 9.5 7 1.4 0 2.7-.3 3.8-.8"/></svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </span>
  );
}
