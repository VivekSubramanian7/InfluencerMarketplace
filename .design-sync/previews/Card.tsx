import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Badge,
} from 'influencer-marketplace';

export const OfferingCard = () => (
  <Card style={{ maxWidth: 420 }}>
    <CardHeader>
      <CardTitle>Dedicated review video</CardTitle>
      <CardDescription>
        Dedicated video · 14-day turnaround · 2 revisions included
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        A full 3–5 minute review of your product on my channel, including
        b-roll and an honest verdict.
      </p>
    </CardContent>
    <CardFooter style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="text-2xl font-extrabold text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
        $450
      </span>
      <Button>Book this</Button>
    </CardFooter>
  </Card>
);

export const StatCard = () => (
  <Card style={{ maxWidth: 260 }}>
    <CardHeader>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <CardTitle>YouTube</CardTitle>
        <Badge className="bg-amber text-amber-foreground hover:bg-amber">Verified</Badge>
      </div>
      <CardDescription>@mayafilms</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-extrabold" style={{ fontVariantNumeric: 'tabular-nums' }}>48.2K</p>
      <p className="text-xs text-muted-foreground">followers</p>
    </CardContent>
  </Card>
);
