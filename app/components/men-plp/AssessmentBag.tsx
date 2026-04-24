import {Badge} from '~/components/ui/badge';
import {Button} from '~/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '~/components/ui/card';
import {formatMoney} from '~/lib/men-plp';
import type {BagItem} from '~/lib/men-plp/plp-api-types';

type AssessmentBagProps = {
  isOpen: boolean;
  items: BagItem[];
  onClose: () => void;
};

export function AssessmentBag({isOpen, items, onClose}: AssessmentBagProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price?.amount ?? 0) * item.quantity,
    0,
  );

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-20 w-[min(22rem,calc(100vw-2rem))]">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge className="mb-2" variant="secondary">
                Local cart state
              </Badge>
              <CardTitle>Bag</CardTitle>
            </div>
            <Button onClick={onClose} size="sm" type="button" variant="ghost">
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length ? (
            <>
              <ul className="max-h-80 space-y-3 overflow-y-auto">
                {items.map((item) => (
                  <li
                    className="grid grid-cols-[64px_minmax(0,1fr)] gap-3"
                    key={item.variantId}
                  >
                    {item.imageUrl ? (
                      <img
                        alt={item.productTitle}
                        className="h-16 w-16 rounded-md object-cover"
                        loading="lazy"
                        src={item.imageUrl}
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-md bg-neutral-100" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.productTitle}</p>
                      <p className="text-xs text-neutral-600">
                        {item.optionsLabel || item.variantTitle}
                      </p>
                      <p className="text-xs text-neutral-600">
                        Qty {item.quantity}
                        {' · '}
                        {formatMoney(item.price) ?? 'Price unavailable'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                <p className="text-sm text-neutral-600">Subtotal</p>
                <strong>
                  {new Intl.NumberFormat('en-US', {
                    currency: 'USD',
                    style: 'currency',
                  }).format(subtotal)}
                </strong>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-600">
              Quick add writes into local state for the assessment. Nothing has
              been added yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
