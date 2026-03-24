/**
 * Build the expression to insert based on context.
 * If cursor is inside ${...}, insert just the expression.
 * Otherwise wrap in ${expression}.
 */
export function buildExpression(variable, input) {
  const expr = variable.spinExpression || variable.name;

  const value = input.value || input.textContent || '';
  const cursorPos = input.selectionStart != null ? input.selectionStart : value.length;

  const before = value.substring(0, cursorPos);
  const lastDollarBrace = before.lastIndexOf('${');
  const lastCloseBrace = before.lastIndexOf('}');

  if (lastDollarBrace !== -1 && lastDollarBrace > lastCloseBrace) {
    return expr;
  }

  return '${' + expr + '}';
}

/**
 * Insert text at the current cursor position in an input/textarea.
 */
export function insertTextAtCursor(input, text) {
  if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const before = input.value.substring(0, start);
    const after = input.value.substring(end);

    const proto = input.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(input, before + text + after);
    } else {
      input.value = before + text + after;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const newPos = start + text.length;
    input.setSelectionRange(newPos, newPos);
    input.focus();
  } else if (input.contentEditable === 'true') {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      input.textContent += text;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
