import {
  useMemo,
  useState,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { ConnectionGraph } from "../core/graph.ts";
import type { Entity } from "../core/model.ts";
import type { AlleyLoopCopy } from "../i18n/copy.ts";
import type { PortraitProps } from "../presentation/types.ts";

interface PlayerSearchProps {
  graph: ConnectionGraph;
  currentPlayer: Entity;
  usedIds: readonly string[];
  copy: AlleyLoopCopy;
  portrait: ComponentType<PortraitProps>;
  resultMeta?: (entity: Entity) => ReactNode;
  disabled?: boolean;
  onSubmit(entity: Entity): boolean;
}

export function PlayerSearch({
  graph,
  currentPlayer,
  usedIds,
  copy,
  portrait: Portrait,
  resultMeta,
  disabled = false,
  onSubmit,
}: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Entity | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => graph.search(query, 8), [graph, query]);

  const choose = (entity: Entity) => {
    setSelected(entity);
    setQuery(entity.label);
    setOpen(false);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected || disabled) return;
    if (onSubmit(selected)) {
      setQuery("");
      setSelected(null);
      setOpen(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && !selected) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <form className="player-search" onSubmit={submit}>
      <label className="search-label" htmlFor="player-search-input">
        {copy.prompt(currentPlayer.label)}
      </label>
      <div
        className="search-composer"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <div className="search-field-wrap">
          <span className="search-icon" aria-hidden="true" />
          <input
            id="player-search-input"
            type="search"
            value={query}
            placeholder={copy.searchPlaceholder}
            autoComplete="off"
            disabled={disabled}
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls="player-search-results"
            aria-expanded={open}
            aria-activedescendant={open && results[activeIndex] ? `player-result-${results[activeIndex].id}` : undefined}
            onFocus={() => setOpen(Boolean(query.trim()))}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setActiveIndex(0);
              setOpen(Boolean(event.target.value.trim()));
            }}
            onKeyDown={onKeyDown}
          />
          {selected ? <Portrait entity={selected} size="small" /> : null}
        </div>
        <button className="lob-button" type="submit" disabled={!selected || disabled}>
          <span aria-hidden="true">↗</span>
          {copy.submit}
        </button>
        {open ? (
          <div className="search-results" id="player-search-results" role="listbox">
            {results.length ? results.map((entity, index) => {
              const used = usedIds.includes(entity.id);
              return (
                <button
                  className={index === activeIndex ? "search-result active" : "search-result"}
                  id={`player-result-${entity.id}`}
                  type="button"
                  role="option"
                  aria-selected={selected?.id === entity.id}
                  key={entity.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(entity)}
                >
                  <Portrait entity={entity} size="small" />
                  <span className="result-copy">
                    <strong>{entity.label}</strong>
                    {resultMeta ? <span className="result-meta">{resultMeta(entity)}</span> : null}
                  </span>
                  {used ? <span className="used-badge">{copy.alreadyUsed}</span> : null}
                </button>
              );
            }) : <p className="no-results">{copy.noResults}</p>}
          </div>
        ) : null}
      </div>
    </form>
  );
}
