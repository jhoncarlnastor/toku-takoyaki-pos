export type Category = "Takoyaki" | "Drinks";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: Category;
  stock: number;
  image_url?: string | null;
}

export interface SelectedAddOn {
  id: string;
  name: string;
  price: number;
}

export interface CartLine {
  item: MenuItem;
  qty: number;
  addOns?: SelectedAddOn[];
}

export const INITIAL_MENU: MenuItem[] = [
  { id: "tk-classic-6", name: "Classic Takoyaki (6 pcs)", price: 79, category: "Takoyaki", stock: 40 },
  { id: "tk-classic-12", name: "Classic Takoyaki (12 pcs)", price: 149, category: "Takoyaki", stock: 30 },
  { id: "tk-cheese-6", name: "Cheesy Takoyaki (6 pcs)", price: 99, category: "Takoyaki", stock: 25 },
  { id: "tk-cheese-12", name: "Cheesy Takoyaki (12 pcs)", price: 189, category: "Takoyaki", stock: 8 },
  { id: "tk-spicy-6", name: "Spicy Mayo Takoyaki (6 pcs)", price: 99, category: "Takoyaki", stock: 22 },
  { id: "tk-bacon-6", name: "Bacon Takoyaki (6 pcs)", price: 109, category: "Takoyaki", stock: 5 },
  { id: "tk-shrimp-6", name: "Ebi Shrimp Takoyaki (6 pcs)", price: 119, category: "Takoyaki", stock: 0 },
  { id: "tk-combo", name: "Toku Sharing Platter (24 pcs)", price: 329, category: "Takoyaki", stock: 15 },
  { id: "dr-iced-tea", name: "Iced Tea", price: 45, category: "Drinks", stock: 60 },
  { id: "dr-lemonade", name: "Lemonade", price: 55, category: "Drinks", stock: 45 },
  { id: "dr-ramune", name: "Ramune Soda", price: 85, category: "Drinks", stock: 9 },
  { id: "dr-matcha", name: "Iced Matcha Latte", price: 119, category: "Drinks", stock: 20 },
  { id: "dr-water", name: "Bottled Water", price: 25, category: "Drinks", stock: 80 },
];

export const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
