/** Browser clipboard with the same fallback as the source controls. */
export async function writeClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement('textarea');
    field.value = value;
    field.readOnly = true;
    Object.assign(field.style, { position: 'fixed', opacity: '0', fontSize: '16px' });
    document.body.append(field);
    try {
      field.select();
      field.setSelectionRange(0, value.length);
      if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
    } finally {
      field.remove();
    }
  }
}
