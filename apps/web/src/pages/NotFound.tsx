import { PageShell } from '@oa/ui';

export function NotFound() {
  return (
    <PageShell>
      <h1 className="oa-display text-[40px] leading-none">Nothing here</h1>
      <p className="mt-oa-3">Please use the link from your flyer or your UR Pass email.</p>
    </PageShell>
  );
}
