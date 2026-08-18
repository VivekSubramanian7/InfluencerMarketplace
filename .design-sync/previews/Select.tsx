import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup,
  SelectLabel, SelectItem,
} from 'influencer-marketplace';

export const FormatFilter = () => (
  <Select defaultValue="dedicated_video">
    <SelectTrigger style={{ width: 224 }}>
      <SelectValue placeholder="Any format" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Video formats</SelectLabel>
        <SelectItem value="dedicated_video">Dedicated video</SelectItem>
        <SelectItem value="integration">Integration (60-90s)</SelectItem>
        <SelectItem value="short_form_post">Short-form post</SelectItem>
        <SelectItem value="ugc_video">UGC video</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
);

export const RatingSelect = () => (
  <Select defaultValue="5">
    <SelectTrigger style={{ width: 120 }}>
      <SelectValue placeholder="Rating" />
    </SelectTrigger>
    <SelectContent>
      {['5', '4', '3', '2', '1'].map((n) => (
        <SelectItem key={n} value={n}>{n} ★</SelectItem>
      ))}
    </SelectContent>
  </Select>
);
