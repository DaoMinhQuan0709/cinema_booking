// Keep keyboard navigation inside a modal, including browsers that Tab to chrome at the end.
export function trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget;
  const targets = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
  const first = targets[0];
  const last = targets.at(-1);
  const active = dialog.ownerDocument.activeElement;
  if (!first) {
    event.preventDefault();
    dialog.focus();
  } else if (event.shiftKey && (active === first || !dialog.contains(active) || active === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !dialog.contains(active) || active === dialog)) {
    event.preventDefault();
    first.focus();
  }
}
