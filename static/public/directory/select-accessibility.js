// Compatibility bridge for the pinned Rettangoli 1.21 select.
// Rendering and pointer selection stay in the component.
export function connectSelect(select, label, onChange) {
  const trigger = () => select.shadowRoot?.querySelector('#selectButton');
  const popover = () => select.shadowRoot?.querySelector('#popover');
  const isOpen = () => popover()?.hasAttribute('open') ?? false;
  const close = () => {
    popover()?.dispatchEvent(new CustomEvent('close'));
    requestAnimationFrame(() => trigger()?.focus());
  };

  function sync() {
    const button = trigger();
    if (!button) return;
    if (isOpen()) {
      const rect = button.getBoundingClientRect();
      // Anchor the existing popover below the control instead of its cursor offset.
      for (const [name, value] of Object.entries({ place: 'bs', x: rect.left, y: rect.bottom, 'content-wh': Math.min(300, window.innerWidth - rect.left - 16) })) {
        if (popover().getAttribute(name) !== String(value)) popover().setAttribute(name, String(value));
      }
    }
    const options = select.options || [];
    const selected = options.findIndex((option) => option.value === select.selectedValue);
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', String(isOpen()));
    button.setAttribute('aria-controls', 'select-options');
    button.setAttribute('aria-activedescendant', `option${Math.max(0, selected)}`);
    const list = select.shadowRoot.querySelector('[data-rtgl-popover-content]');
    if (list) {
      list.id = 'select-options';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', label);
    }
    select.shadowRoot.querySelectorAll('[id^="option"]').forEach((option, index) => {
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === selected));
    });
  }

  select.addEventListener('value-change', (event) => {
    onChange(event.detail.value ?? '');
    requestAnimationFrame(() => { sync(); trigger()?.focus(); });
  });
  select.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const options = select.options;
      const current = Math.max(0, options.findIndex((option) => option.value === select.selectedValue));
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
      onChange(options[next].value);
    } else if (event.key === 'Escape' || (isOpen() && ['Enter', ' '].includes(event.key))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    } else if (event.key === 'Tab' && isOpen()) {
      popover()?.dispatchEvent(new CustomEvent('close'));
    }
  }, true);
  // The component captures viewport coordinates only when opening its menu.
  const dismissOnLayoutChange = (event) => {
    if (isOpen() && !event.composedPath().includes(select)) {
      popover().dispatchEvent(new CustomEvent('close'));
    }
  };
  window.addEventListener('scroll', dismissOnLayoutChange, { capture: true, passive: true });
  window.addEventListener('resize', dismissOnLayoutChange);
  new MutationObserver(sync).observe(select.shadowRoot, { childList: true, subtree: true });
  requestAnimationFrame(sync);
  return sync;
}
