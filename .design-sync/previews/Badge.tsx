import { Badge } from 'influencer-marketplace';

export const Niches = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Badge variant="secondary">gaming</Badge>
    <Badge variant="secondary">tech</Badge>
    <Badge variant="secondary">coffee</Badge>
  </div>
);

export const Verified = () => (
  <Badge className="bg-amber text-amber-foreground hover:bg-amber">Verified</Badge>
);

export const Attention = () => (
  <div style={{ display: 'flex', gap: 8 }}>
    <Badge className="bg-amber text-amber-foreground hover:bg-amber">Disputed</Badge>
    <Badge className="bg-amber text-amber-foreground hover:bg-amber">Awaiting approval</Badge>
    <Badge variant="secondary">In production</Badge>
  </div>
);
