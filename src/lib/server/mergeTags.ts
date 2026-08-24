/** Replaces {{merge_tags}} in email content with values from `data`. Unknown tags render as empty string. */
export function renderMergeTags(html: string, data: Record<string, unknown>): string {
  return html.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
