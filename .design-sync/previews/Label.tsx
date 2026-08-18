import { Label, Input } from 'influencer-marketplace';

// Labels belong with their fields — the pair is the true render.
export const WithField = () => (
  <div style={{ display: 'grid', gap: 8, maxWidth: 300 }}>
    <Label htmlFor="country">Country</Label>
    <Input id="country" placeholder="Germany" />
  </div>
);
