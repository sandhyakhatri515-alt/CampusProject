import { useState } from 'react';
import { FiEye, FiEyeOff, FiLock } from 'react-icons/fi';

// Password field with a show/hide toggle. Extra props go to the <input>.
export default function PasswordInput({ lockIcon = true, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-icon">
      {lockIcon && <FiLock />}
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className="input"
        style={{ paddingRight: 46, ...(lockIcon ? {} : { paddingLeft: 14 }) }}
      />
      <button
        type="button"
        className="eye-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <FiEyeOff /> : <FiEye />}
      </button>
    </div>
  );
}
