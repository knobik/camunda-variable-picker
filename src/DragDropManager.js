import { buildExpression, insertTextAtCursor } from './expressionUtils';

const DROP_HOVER_CLASS = 'variable-picker-drop-hover';

const INPUT_SELECTOR = [
  'input.bio-properties-panel-input[type="text"]',
  'textarea.bio-properties-panel-input',
  '[contenteditable].bio-properties-panel-input'
].join(', ');

export default class DragDropManager {

  constructor() {
    this._isDragging = false;
    this._propertiesContainer = null;
    this._onFieldFocus = null;
    this._onFieldBlur = null;
    this._handlers = null;
  }

  attach(propertiesContainer, onFieldFocus, onFieldBlur) {
    this.detach();

    this._propertiesContainer = propertiesContainer;
    this._onFieldFocus = onFieldFocus;
    this._onFieldBlur = onFieldBlur;

    this._handlers = {
      focusin: (e) => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input && this._onFieldFocus) {
          this._onFieldFocus(input);
        }
      },
      focusout: (e) => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input && this._onFieldBlur) {
          this._onFieldBlur(input);
        }
      },
      dragover: (e) => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      },
      dragenter: (e) => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input) {
          e.preventDefault();
          input.classList.add(DROP_HOVER_CLASS);
        }
      },
      dragleave: (e) => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input) {
          input.classList.remove(DROP_HOVER_CLASS);
        }
      },
      drop: (e) => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (!input) return;

        e.preventDefault();
        input.classList.remove(DROP_HOVER_CLASS);

        const data = e.dataTransfer.getData('application/variable-picker');
        if (!data) return;

        let variable;
        try {
          variable = JSON.parse(data);
        } catch {
          return;
        }

        const expression = buildExpression(variable, input);
        insertTextAtCursor(input, expression);

        this._isDragging = false;
      }
    };

    for (const [event, handler] of Object.entries(this._handlers)) {
      propertiesContainer.addEventListener(event, handler, true);
    }
  }

  detach() {
    if (this._propertiesContainer && this._handlers) {
      for (const [event, handler] of Object.entries(this._handlers)) {
        this._propertiesContainer.removeEventListener(event, handler, true);
      }
    }
    this._handlers = null;
    this._propertiesContainer = null;
  }

  get isDragging() {
    return this._isDragging;
  }

  setDragging(value) {
    this._isDragging = value;
  }
}
