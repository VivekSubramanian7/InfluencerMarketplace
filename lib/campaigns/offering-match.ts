export function creatorCanApply(args: {
  campaignType: string;
  activeOfferingTypes: string[];
}): boolean {
  return args.activeOfferingTypes.includes(args.campaignType);
}
