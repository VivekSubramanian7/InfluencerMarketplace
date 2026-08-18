import { Separator } from 'influencer-marketplace';

export const Horizontal = () => (
  <div style={{ maxWidth: 360 }}>
    <p style={{ fontSize: 14, fontWeight: 600 }}>Brief</p>
    <Separator style={{ marginTop: 12, marginBottom: 12 }} />
    <p style={{ fontSize: 14 }}>Timeline</p>
  </div>
);

export const Vertical = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 24, fontSize: 14 }}>
    <span>48.2K followers</span>
    <Separator orientation="vertical" />
    <span>4.8 ★ rating</span>
    <Separator orientation="vertical" />
    <span>12 deals</span>
  </div>
);
