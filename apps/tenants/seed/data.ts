// Entirely fictional. Each tenant has a "confidential" doc so a leak would be obvious in the UI.
export const SEED = {
  acme: {
    name: "Acme Cleaning Co.",
    email: "alice@acme.test",
    docs: [
      { title: "Pricing", content: "Acme charges 45 euros per hour for standard apartment cleaning." },
      { title: "Confidential: Project Falcon", content: "Project Falcon is Acme's plan to acquire two regional competitors next spring." },
      { title: "Supplies", content: "Acme orders eco-friendly detergent and microfiber cloths monthly from one supplier." },
    ],
  },
  globex: {
    name: "Globex Property Mgmt",
    email: "bob@globex.test",
    docs: [
      { title: "Pricing", content: "Globex takes a 12 percent management fee on monthly rental income." },
      { title: "Confidential: Project Hydra", content: "Project Hydra is Globex's plan to move all owner statements to a new billing vendor." },
      { title: "Check-in policy", content: "Globex guests check in with a self-service lockbox code sent the day before arrival." },
    ],
  },
} as const;
