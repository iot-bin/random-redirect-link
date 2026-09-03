'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
} from '@/app/components/Icons';

export interface DropdownOption<Value extends string> {
  value: Value;
  label: string;
  description?: string;
}

interface DropdownSelectProps<Value extends string> {
  value: Value;
  options: ReadonlyArray<DropdownOption<Value>>;
  onChange: (value: Value) => void;
  ariaLabel: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function DropdownSelect<Value extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  disabled = false,
  className,
}: DropdownSelectProps<Value>) {
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  function openMenu(index = selectedIndex) {
    if (disabled || options.length === 0) return;
    setActiveIndex(index);
    setOpen(true);
  }

  function selectOption(option: DropdownOption<Value>) {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const index = event.key === 'ArrowUp' ? options.length - 1 : selectedIndex;
      openMenu(index);
    }
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index + direction + options.length) % options.length);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
    }
  }

  const rootClassName = className
    ? `dropdown-select ${className}`
    : 'dropdown-select';

  return (
    <div
      className={rootClassName}
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        className="dropdown-trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{selectedOption?.label ?? ariaLabel}</span>
        <ChevronDownIcon className={open ? 'is-open' : undefined} />
      </button>

      {open ? (
        <div className="dropdown-menu" id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              className={option.value === value ? 'dropdown-option is-selected' : 'dropdown-option'}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => selectOption(option)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
              {option.value === value ? <CheckIcon /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
