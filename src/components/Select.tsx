import { Select as S } from '@base-ui/react/select';

interface Props<V extends string | number> {
  id: string;
  label: string;
  value: V;
  items: { value: V; label: string }[];
  onChange: (v: V) => void;
}

/** Accessible select built on base-ui primitives. */
export default function Select<V extends string | number>({ id, label, value, items, onChange }: Props<V>) {
  return (
    <S.Root value={value} onValueChange={(v) => v !== null && onChange(v as V)} items={items}>
      <S.Trigger id={id} className="sel" aria-label={label}>
        <S.Value className="sel-val" />
        <S.Icon className="sel-ico">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Positioner className="sel-pos" sideOffset={6} alignItemWithTrigger={false}>
          <S.Popup className="sel-pop">
            <S.List>
              {items.map((it) => (
                <S.Item key={String(it.value)} value={it.value} className="sel-item">
                  <S.ItemIndicator className="sel-check">
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </S.ItemIndicator>
                  <S.ItemText>{it.label}</S.ItemText>
                </S.Item>
              ))}
            </S.List>
          </S.Popup>
        </S.Positioner>
      </S.Portal>
    </S.Root>
  );
}
