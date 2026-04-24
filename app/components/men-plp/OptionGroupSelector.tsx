import {Button} from '~/components/ui/button';
import {cn} from '~/lib/cn';
import {getVariantValue, type PlpOptionGroup, type PlpVariant} from '~/lib/men-plp';
import {
  findFirstAvailableVariant,
  getOptionValueLabel,
  getSwatchColor,
} from '~/lib/men-plp/plp-card-helpers';

type OptionGroupSelectorProps = {
  controlsDisabled: boolean;
  currentSelection: Record<string, string>;
  group: PlpOptionGroup;
  isOptimisticallyLoading?: boolean;
  onSelect: (group: PlpOptionGroup, value: string) => void;
  optionGroups: PlpOptionGroup[];
  variants: PlpVariant[];
};

export function OptionGroupSelector({
  controlsDisabled,
  currentSelection,
  group,
  isOptimisticallyLoading = false,
  onSelect,
  optionGroups,
  variants,
}: OptionGroupSelectorProps) {
  const loadedValues = new Set(
    variants
      .map((variant) => getVariantValue(variant, group.key))
      .filter((value): value is string => Boolean(value)),
  );

  return (
    <fieldset className="space-y-1" disabled={controlsDisabled}>
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {group.label}
      </legend>
      <div
        className={cn('flex flex-wrap', group.kind === 'color' ? 'gap-2' : 'gap-1')}
      >
        {group.values.map((value) => {
          const isPending = isOptimisticallyLoading && !loadedValues.has(value);
          const isActive = currentSelection[group.key] === value;
          const isAvailable = Boolean(
            !isPending &&
              findFirstAvailableVariant(variants, optionGroups, {
                ...currentSelection,
                [group.key]: value,
              }),
          );
          const isDisabled = controlsDisabled || isPending || !isAvailable;
          const showActiveState = isActive && !isDisabled;
          const valueLabel = getOptionValueLabel(group, value);

          return group.kind === 'color' ? (
            <button
              key={`${group.key}-${value}`}
              type="button"
              aria-label={`${group.label}: ${value}${
                isPending ? ' loading' : isDisabled ? ' sold out' : ''
              }`}
              aria-pressed={isActive}
              className={cn(
                'relative h-7 w-7 overflow-hidden rounded-full border-2 p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2',
                showActiveState
                  ? 'border-black ring-2 ring-black ring-offset-2'
                  : 'border-neutral-300',
                isPending && 'cursor-progress border-dashed opacity-70',
                isDisabled && !isPending && 'cursor-not-allowed opacity-35',
              )}
              disabled={isDisabled}
              onClick={() => onSelect(group, value)}
            >
              <span
                aria-hidden="true"
                className="block h-full w-full rounded-full"
                style={{backgroundColor: getSwatchColor(value)}}
              />
              {!isPending && !isAvailable ? (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-black"
                />
              ) : null}
              <span className="sr-only">{value}</span>
            </button>
          ) : (
            <Button
              key={`${group.key}-${value}`}
              type="button"
              variant="outline"
              aria-pressed={isActive}
              className={cn(
                'border text-black disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400',
                showActiveState &&
                  'border-black ring-1 ring-black bg-neutral-100 text-black hover:bg-neutral-100',
                isPending &&
                  'border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 disabled:border-neutral-300 disabled:bg-neutral-50 disabled:text-neutral-500',
              )}
              disabled={isDisabled}
              onClick={() => onSelect(group, value)}
              size="sm"
            >
              {valueLabel}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
