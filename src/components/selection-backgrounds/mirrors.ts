/** Mirror hosts use IDs so view inputs and Models never need native nodes.
 * Hosts share the table's containing root and use its coordinate system. */
export function resolveMirrors(root: HTMLElement, attribute: string) {
  let ids: string[] = [];
  try {
    const value: unknown = JSON.parse(root.getAttribute(attribute) ?? '[]');
    if (Array.isArray(value))
      ids = [
        ...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0)),
      ];
  } catch {
    /* An absent or externally changed presentation attribute has no hosts. */
  }
  const owner = root.getRootNode() as Document | ShadowRoot;
  const hosts = ids.flatMap((id) => {
    const host = owner.getElementById(id);
    return host instanceof HTMLElement && host !== root && !host.closest('.ff-selection-background')
      ? [host]
      : [];
  });
  return { hosts, enabled: ids.length > 0 };
}
