export type ReviewTone = {
  surface: string;
  accent: string;
  icon: string;
};

export function reviewTone({
  acknowledged,
}: {
  reviewStatus: string;
  acknowledged: boolean;
}): ReviewTone {
  if (acknowledged) {
    return {
      surface: "border-sage/30 bg-sage/5",
      accent: "text-sage",
      icon: "border-sage/30 bg-ledger text-sage",
    };
  }
  return {
    surface: "border-ember/30 bg-parchment/60",
    accent: "text-ember",
    icon: "border-ember/30 bg-ledger text-ember",
  };
}
