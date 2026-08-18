import { Input, Label, Button } from 'influencer-marketplace';

export const WithLabel = () => (
  <div style={{ display: 'grid', gap: 8, maxWidth: 340 }}>
    <Label htmlFor="handle">Handle (your public URL: /c/…)</Label>
    <Input id="handle" defaultValue="mayafilms" />
  </div>
);

export const SearchPill = () => (
  <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
    <Input
      placeholder="Search by name, handle, or bio"
      style={{ borderRadius: 9999, height: 40, paddingLeft: 16 }}
    />
    <Button style={{ borderRadius: 9999, height: 40 }}>Search</Button>
  </div>
);

export const PriceField = () => (
  <div style={{ display: 'grid', gap: 8, maxWidth: 200 }}>
    <Label htmlFor="price">Price (USD)</Label>
    <Input id="price" inputMode="decimal" defaultValue="450" />
  </div>
);
