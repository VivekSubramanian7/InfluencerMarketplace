import { Button } from 'influencer-marketplace';

export const Primary = () => <Button>Book this creator</Button>;

export const Variants = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
    <Button>Get started free</Button>
    <Button variant="outline">See a live storefront</Button>
    <Button variant="secondary">Save draft</Button>
    <Button variant="ghost">Log out</Button>
  </div>
);

export const ConfirmClass = () => (
  <div style={{ display: 'flex', gap: 12 }}>
    <Button variant="outline" className="text-destructive border-destructive/40">Cancel deal</Button>
    <Button variant="outline" className="text-destructive border-destructive/40">Open dispute</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    <Button size="sm">Resolve</Button>
    <Button>Send booking request</Button>
    <Button size="lg" className="px-7">Create your account</Button>
  </div>
);

export const Disabled = () => <Button disabled>Processing…</Button>;
