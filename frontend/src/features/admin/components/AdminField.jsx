import { cloneElement, useId } from 'react';

// Wrap one input/select/textarea and keep label, help text and validation connected.
export default function AdminField({ label, error, hint, required = false, children }) {
  const generatedId = useId();
  const id = children.props.id || generatedId;
  const messageId = `${id}-message`;
  const describedBy = [children.props['aria-describedby'], error || hint ? messageId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-white">{label}{required && <span aria-hidden="true" className="ml-1 text-primary">*</span>}</label>
      {cloneElement(children, { id, required: required || children.props.required,
        'aria-invalid': Boolean(error), 'aria-describedby': describedBy,
        className: `min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm text-white placeholder:text-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${error ? 'border-primary' : 'border-surfaceBorder'} ${children.props.className || ''}`,
      })}
      {(error || hint) && <p id={messageId} role={error ? 'alert' : undefined} className={`text-xs ${error ? 'text-red-400' : 'text-muted'}`}>{error || hint}</p>}
    </div>
  );
}
