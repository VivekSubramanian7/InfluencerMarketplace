import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup,
  SelectLabel, SelectItem,
} from 'influencer-marketplace';

// SelectGroup only renders inside a Select — the full composition is the
// only true render.
export const InContext = () => (
  <Select defaultValue="gaming">
    <SelectTrigger style={{ width: 200 }}>
      <SelectValue placeholder="Niche" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Popular niches</SelectLabel>
        <SelectItem value="gaming">Gaming</SelectItem>
        <SelectItem value="beauty">Beauty</SelectItem>
        <SelectItem value="tech">Tech</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);
