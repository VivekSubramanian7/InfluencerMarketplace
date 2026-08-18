import { Textarea, Label } from 'influencer-marketplace';

export const BriefGoals = () => (
  <div style={{ display: 'grid', gap: 8, maxWidth: 460 }}>
    <Label htmlFor="goals">Goals — what does success look like? *</Label>
    <Textarea
      id="goals"
      rows={4}
      defaultValue="We are launching a compact espresso grinder aimed at apartment kitchens. Success is honest coverage of the grind consistency and noise level, with the discount code in the description."
    />
  </div>
);

export const Empty = () => (
  <div style={{ display: 'grid', gap: 8, maxWidth: 460 }}>
    <Label htmlFor="msg">Write a message</Label>
    <Textarea id="msg" rows={3} placeholder="Say hello — ask about turnaround or formats" />
  </div>
);
