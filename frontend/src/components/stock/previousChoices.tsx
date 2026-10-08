export interface StockChoice {
  type?: string;
  size: string;
  sizeLabel?: string;
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface BuiltSuggestions {
  typeOptions: ChoiceOption[];
  sizeOptions: ChoiceOption[];
  otherSizeOptions: ChoiceOption[];
  typeIsNew: boolean;
  sizeIsNew: boolean;
  alreadyExists: boolean;
  typedType: string;
}

function uniqueOptions(rows: { value: string; label?: string }[]): ChoiceOption[] {
  const seen = new Map<string, ChoiceOption>();
  for (const row of rows) {
    const value = row.value.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (!seen.has(key)) seen.set(key, { value, label: (row.label || value).trim() || value });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
}

export function sameText(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function includesQuery(value: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return value.toLowerCase().includes(q);
}

function sizeCore(value: string) {
  return value.trim().toLowerCase().replace(/\s*feet?\s*/gi, '').replace(/\s*ft\s*/gi, '').trim();
}

function sizeMatches(row: StockChoice, typed: string) {
  const query = typed.trim();
  if (!query) return false;
  return sameText(row.size, query) || sameText(row.sizeLabel || '', query) || (sizeCore(row.size) !== '' && sizeCore(row.size) === sizeCore(query));
}

export function buildSuggestions(
  suggestions: StockChoice[],
  typeValue: string,
  sizeValue: string,
  emptyType: string | null,
): BuiltSuggestions {
  const typeOptionsAll = uniqueOptions(suggestions.map((row) => ({ value: row.type || '' })));
  const typedType = typeValue.trim();
  const typeIsExact = typeOptionsAll.some((option) => sameText(option.value, typeValue));
  const typeOptions = !typedType || typeIsExact
    ? typeOptionsAll
    : typeOptionsAll.filter((option) => includesQuery(option.label, typeValue));
  const typeIsNew = Boolean(typedType) && !typeOptionsAll.some((option) => sameText(option.value, typedType));
  const activeType = typedType || (emptyType ?? '');
  const useType = emptyType !== null && Boolean(typedType);
  const inType = (row: StockChoice) => !useType || sameText(row.type || emptyType || '', activeType);
  const sizeOptionsAll = uniqueOptions(suggestions.filter((row) => row.size).map((row) => ({ value: row.size, label: row.sizeLabel })));
  const sizesForType = uniqueOptions(suggestions.filter((row) => row.size && inType(row)).map((row) => ({ value: row.size, label: row.sizeLabel })));
  const otherSizes = uniqueOptions(
    suggestions.filter((row) => row.size && useType && !inType(row)).map((row) => ({ value: row.size, label: row.sizeLabel })),
  ).filter((option) => !sizesForType.some((known) => sameText(known.value, option.value)));
  const sizeIsExact = sizeOptionsAll.some((option) => sizeMatches({ size: option.value, sizeLabel: option.label }, sizeValue));
  const keepSize = (option: ChoiceOption) => !sizeValue.trim() || sizeIsExact || includesQuery(option.label, sizeValue) || includesQuery(option.value, sizeValue);
  const sizeIsNew = Boolean(sizeValue.trim()) && !sizeOptionsAll.some((option) => sizeMatches({ size: option.value, sizeLabel: option.label }, sizeValue));
  const alreadyExists = Boolean(sizeValue.trim()) && suggestions.some((row) => sizeMatches(row, sizeValue) && (
    emptyType === null || sameText(row.type || emptyType || '', activeType)
  ));
  return {
    typeOptions,
    sizeOptions: (useType ? sizesForType : sizeOptionsAll).filter(keepSize),
    otherSizeOptions: otherSizes.filter(keepSize),
    typeIsNew,
    sizeIsNew,
    alreadyExists,
    typedType,
  };
}

export function ChoiceList({
  label,
  options,
  selected,
  onPick,
}: {
  label: string;
  options: ChoiceOption[];
  selected: string;
  onPick: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="mt-2">
      <p className="text-xs text-red-100 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = Boolean(selected.trim()) && (
            sameText(selected, option.value)
            || sameText(selected, option.label)
            || (sizeCore(selected) !== '' && sizeCore(selected) === sizeCore(option.value))
          );
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onPick(option.value)}
              className={`px-2.5 py-1 rounded-full text-sm border ${
                active
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'bg-black border-red-800 text-red-100 hover:border-red-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
