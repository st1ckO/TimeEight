"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useState } from "react";

type TimezoneOption = { value: string; label: string; region: string };
export function TimezonePicker({
  value,
  options,
  commonZones,
  labelId,
  disabled,
  onChange,
}: {
  value: string;
  options: TimezoneOption[];
  commonZones: string[];
  labelId: string;
  disabled: boolean;
  onChange(value: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const search = query.trim().toLowerCase().replaceAll("_", " ");
  const results = options.filter((option) =>
    search
      ? option.label.toLowerCase().includes(search)
      : commonZones.includes(option.value) || option.value === value,
  );
  const regions = [...new Set(results.map((option) => option.region))];
  const ordered = regions.flatMap((region) =>
    results.filter((option) => option.region === region),
  );
  function choose(zone: string) {
    onChange(zone);
    setOpen(false);
  }
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
        setActive(0);
      }}
    >
      <Popover.Trigger
        className="entry-task-trigger"
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby="timezone-help"
      >
        <span>
          {options.find((option) => option.value === value)?.label ?? value}
        </span>
        <ChevronDown size={18} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="entry-task-menu timezone-search-menu"
          aria-label="Choose timezone"
          align="start"
          sideOffset={6}
          collisionPadding={14}
        >
          <div className="timezone-search">
            <Search size={16} aria-hidden />
            <input
              aria-label="Search timezones"
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={
                ordered[active] ? listId + "-" + active : undefined
              }
              placeholder="Search city, zone, or UTC offset"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (ordered[active]) choose(ordered[active].value);
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const next = ordered.length
                    ? (active +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        ordered.length) %
                      ordered.length
                    : 0;
                  setActive(next);
                  document
                    .getElementById(listId + "-" + next)
                    ?.scrollIntoView({ block: "nearest" });
                }
              }}
            />
          </div>
          <p className="timezone-search-hint">
            {search
              ? ordered.length + " matching timezones"
              : "Common timezones · search to find any zone"}
          </p>
          <div
            className="timezone-search-results"
            role="listbox"
            aria-label="Timezones"
            id={listId}
          >
            {regions.map((region) => (
              <div role="group" aria-label={region} key={region}>
                <div className="timezone-region">{region}</div>
                {ordered
                  .filter((option) => option.region === region)
                  .map((option) => {
                    const index = ordered.indexOf(option);
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={option.value === value}
                        id={listId + "-" + index}
                        key={option.value}
                        tabIndex={-1}
                        className="entry-task-option timezone-search-option"
                        data-highlighted={index === active ? "" : undefined}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(option.value)}
                      >
                        <span>{option.label}</span>
                        {option.value === value && (
                          <Check size={16} aria-hidden />
                        )}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
          {!ordered.length && (
            <p className="timezone-search-hint" role="status">
              No timezones found. Try a city name or UTC offset.
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
