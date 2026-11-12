// Küchengeräte (SIN-1625). Schlüssel wie der Check in lifestyle.kitchen_appliances; ein weiteres Gerät braucht eine Migration.
export const KUECHENGERAETE = {
  herd: "Herd",
  ofen: "Backofen",
  mikrowelle: "Mikrowelle",
  airfryer: "Airfryer (Heißluftfritteuse)",
  mixer: "Standmixer",
  puerierstab: "Pürierstab",
  wasserkocher: "Wasserkocher",
  toaster: "Toaster",
  reiskocher: "Reiskocher",
  kontaktgrill: "Kontaktgrill",
  dampfgarer: "Dampfgarer",
  kuechenmaschine: "Küchenmaschine",
} as const;
export type Kuechengeraet = keyof typeof KUECHENGERAETE;
export const istKuechengeraet = (text: string): text is Kuechengeraet => text in KUECHENGERAETE;
