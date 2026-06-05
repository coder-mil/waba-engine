import type { SessionContext } from './types/flow';

/**
 * Renders a template string by substituting:
 *   - `{{contexto.X}}`  → value of context[X] (empty string if X not present)
 *   - `{{entity}}`      → currentEntity       (empty string if not present)
 *
 * Templates are rendered EXACTLY ONCE — values pulled from context are inserted
 * literally, even if they themselves contain `{{...}}` markers. This is the
 * anti-loop guarantee: we never re-expand the output of a substitution.
 *
 * @param template       The raw template string (may be empty/undefined)
 * @param context        Session context (variable bag)
 * @param currentEntity  The detected entity for this turn, if any
 * @returns              The rendered string
 */
export function renderTemplate(
  template: string,
  context: SessionContext = {},
  currentEntity: string | null = null
): string {
  if (!template) return '';

  // Single pass for {{contexto.X}}. The replacement string is taken from
  // context AS-IS — we never feed it back through the regex, which is what
  // provides the anti-loop behavior.
  let out = template.replace(/\{\{contexto\.([\w]+)\}\}/g, (_match, key: string) => {
    return context[key] ?? '';
  });

  // Single pass for {{entity}}.
  out = out.replace(/\{\{entity\}\}/g, () => currentEntity ?? '');

  return out;
}
