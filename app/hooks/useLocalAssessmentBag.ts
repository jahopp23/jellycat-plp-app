import {useEffect, useState} from 'react';
import type {BagItem} from '~/lib/men-plp/plp-api-types';
import {BAG_STORAGE_KEY} from '~/lib/men-plp/plp-constants';

export function useLocalAssessmentBag() {
  const [bagItems, setBagItems] = useState<BagItem[]>([]);
  const [bagOpen, setBagOpen] = useState(false);

  useEffect(() => {
    const savedBag = window.localStorage.getItem(BAG_STORAGE_KEY);
    if (!savedBag) return;
    try {
      setBagItems(JSON.parse(savedBag) as BagItem[]);
    } catch {
      window.localStorage.removeItem(BAG_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(bagItems));
    window.dispatchEvent(new Event('jellycat-bag-updated'));
  }, [bagItems]);

  return {bagItems, setBagItems, bagOpen, setBagOpen};
}
