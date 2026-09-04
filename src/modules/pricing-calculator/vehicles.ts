/**
 * Vehicle catalog + sqft lookup. Ported verbatim from
 * ntense-pricing-calc/data/vehicles.ts. Fully static; no API calls.
 */

import type {
  SizeCategory,
  SizeCategoryInfo,
  VehicleData,
  VehicleModel,
} from "./types";

export const sizeCategories: Record<SizeCategory, SizeCategoryInfo> = {
  "sedan-small": {
    label: "Small Sedan",
    minSqFt: 175,
    maxSqFt: 200,
    midpoint: 188,
  },
  "sedan-mid": {
    label: "Mid Sedan",
    minSqFt: 200,
    maxSqFt: 225,
    midpoint: 213,
  },
  "sedan-large": {
    label: "Large Sedan",
    minSqFt: 225,
    maxSqFt: 250,
    midpoint: 238,
  },
  coupe: { label: "Coupe", minSqFt: 160, maxSqFt: 185, midpoint: 173 },
  "sports-car": {
    label: "Sports Car",
    minSqFt: 150,
    maxSqFt: 175,
    midpoint: 163,
  },
  "compact-suv": {
    label: "Compact SUV",
    minSqFt: 225,
    maxSqFt: 260,
    midpoint: 243,
  },
  "mid-suv": { label: "Mid SUV", minSqFt: 260, maxSqFt: 300, midpoint: 280 },
  "full-suv": { label: "Full SUV", minSqFt: 300, maxSqFt: 350, midpoint: 325 },
  "truck-single": {
    label: "Truck (Single Cab)",
    minSqFt: 200,
    maxSqFt: 230,
    midpoint: 215,
  },
  "truck-crew": {
    label: "Truck (Crew Cab)",
    minSqFt: 275,
    maxSqFt: 325,
    midpoint: 300,
  },
  "truck-hd": {
    label: "Truck (HD)",
    minSqFt: 300,
    maxSqFt: 350,
    midpoint: 325,
  },
  van: { label: "Van", minSqFt: 350, maxSqFt: 450, midpoint: 400 },
  exotic: { label: "Exotic", minSqFt: 150, maxSqFt: 180, midpoint: 165 },
};

export const vehicleData: VehicleData[] = [
  {
    make: "Acura",
    models: [
      { name: "ILX", sizeCategory: "sedan-small" },
      { name: "TLX", sizeCategory: "sedan-mid" },
      { name: "RDX", sizeCategory: "compact-suv" },
      { name: "MDX", sizeCategory: "mid-suv" },
      { name: "Integra", sizeCategory: "sedan-small" },
      { name: "NSX", sizeCategory: "sports-car" },
    ],
  },
  {
    make: "Audi",
    models: [
      { name: "A3", sizeCategory: "sedan-small" },
      { name: "A4", sizeCategory: "sedan-mid" },
      { name: "A6", sizeCategory: "sedan-large" },
      { name: "A7", sizeCategory: "sedan-large" },
      { name: "A8", sizeCategory: "sedan-large" },
      { name: "Q3", sizeCategory: "compact-suv" },
      { name: "Q5", sizeCategory: "compact-suv" },
      { name: "Q7", sizeCategory: "mid-suv" },
      { name: "Q8", sizeCategory: "mid-suv" },
      { name: "TT", sizeCategory: "coupe" },
      { name: "R8", sizeCategory: "sports-car" },
      { name: "RS6", sizeCategory: "sedan-large" },
      { name: "e-tron GT", sizeCategory: "sedan-large" },
    ],
  },
  {
    make: "BMW",
    models: [
      { name: "2 Series", sizeCategory: "coupe" },
      { name: "3 Series", sizeCategory: "sedan-mid" },
      { name: "4 Series", sizeCategory: "coupe" },
      { name: "5 Series", sizeCategory: "sedan-large" },
      { name: "7 Series", sizeCategory: "sedan-large" },
      { name: "8 Series", sizeCategory: "coupe" },
      { name: "X1", sizeCategory: "compact-suv" },
      { name: "X3", sizeCategory: "compact-suv" },
      { name: "X5", sizeCategory: "mid-suv" },
      { name: "X7", sizeCategory: "full-suv" },
      { name: "M3", sizeCategory: "sedan-mid" },
      { name: "M4", sizeCategory: "coupe" },
      { name: "M5", sizeCategory: "sedan-large" },
      { name: "i4", sizeCategory: "sedan-mid" },
      { name: "iX", sizeCategory: "mid-suv" },
    ],
  },
  {
    make: "Chevrolet",
    models: [
      { name: "Malibu", sizeCategory: "sedan-mid" },
      { name: "Camaro", sizeCategory: "coupe" },
      { name: "Corvette", sizeCategory: "sports-car" },
      { name: "Equinox", sizeCategory: "compact-suv" },
      { name: "Blazer", sizeCategory: "mid-suv" },
      { name: "Traverse", sizeCategory: "mid-suv" },
      { name: "Tahoe", sizeCategory: "full-suv" },
      { name: "Suburban", sizeCategory: "full-suv" },
      { name: "Silverado 1500", sizeCategory: "truck-crew" },
      { name: "Silverado 2500", sizeCategory: "truck-hd" },
      { name: "Colorado", sizeCategory: "truck-crew" },
    ],
  },
  {
    make: "Dodge",
    models: [
      { name: "Charger", sizeCategory: "sedan-large" },
      { name: "Challenger", sizeCategory: "coupe" },
      { name: "Durango", sizeCategory: "mid-suv" },
      { name: "Hornet", sizeCategory: "compact-suv" },
    ],
  },
  {
    make: "Ferrari",
    models: [
      { name: "296 GTB", sizeCategory: "exotic" },
      { name: "F8", sizeCategory: "exotic" },
      { name: "SF90", sizeCategory: "exotic" },
      { name: "Roma", sizeCategory: "exotic" },
      { name: "812", sizeCategory: "exotic" },
    ],
  },
  {
    make: "Ford",
    models: [
      { name: "Mustang", sizeCategory: "coupe" },
      { name: "Fusion", sizeCategory: "sedan-mid" },
      { name: "Escape", sizeCategory: "compact-suv" },
      { name: "Edge", sizeCategory: "mid-suv" },
      { name: "Explorer", sizeCategory: "mid-suv" },
      { name: "Expedition", sizeCategory: "full-suv" },
      { name: "Bronco", sizeCategory: "mid-suv" },
      { name: "Bronco Sport", sizeCategory: "compact-suv" },
      { name: "F-150", sizeCategory: "truck-crew" },
      { name: "F-250", sizeCategory: "truck-hd" },
      { name: "F-350", sizeCategory: "truck-hd" },
      { name: "Ranger", sizeCategory: "truck-crew" },
      { name: "Maverick", sizeCategory: "truck-single" },
      { name: "Transit", sizeCategory: "van" },
      { name: "GT", sizeCategory: "exotic" },
      { name: "Mach-E", sizeCategory: "compact-suv" },
    ],
  },
  {
    make: "GMC",
    models: [
      { name: "Terrain", sizeCategory: "compact-suv" },
      { name: "Acadia", sizeCategory: "mid-suv" },
      { name: "Yukon", sizeCategory: "full-suv" },
      { name: "Yukon XL", sizeCategory: "full-suv" },
      { name: "Sierra 1500", sizeCategory: "truck-crew" },
      { name: "Sierra 2500", sizeCategory: "truck-hd" },
      { name: "Canyon", sizeCategory: "truck-crew" },
      { name: "Hummer EV", sizeCategory: "truck-hd" },
    ],
  },
  {
    make: "Honda",
    models: [
      { name: "Civic", sizeCategory: "sedan-small" },
      { name: "Accord", sizeCategory: "sedan-mid" },
      { name: "HR-V", sizeCategory: "compact-suv" },
      { name: "CR-V", sizeCategory: "compact-suv" },
      { name: "Passport", sizeCategory: "mid-suv" },
      { name: "Pilot", sizeCategory: "mid-suv" },
      { name: "Ridgeline", sizeCategory: "truck-crew" },
      { name: "Odyssey", sizeCategory: "van" },
    ],
  },
  {
    make: "Hyundai",
    models: [
      { name: "Elantra", sizeCategory: "sedan-mid" },
      { name: "Sonata", sizeCategory: "sedan-mid" },
      { name: "Kona", sizeCategory: "compact-suv" },
      { name: "Tucson", sizeCategory: "compact-suv" },
      { name: "Santa Fe", sizeCategory: "mid-suv" },
      { name: "Palisade", sizeCategory: "full-suv" },
      { name: "Ioniq 5", sizeCategory: "compact-suv" },
      { name: "Ioniq 6", sizeCategory: "sedan-mid" },
      { name: "Veloster N", sizeCategory: "coupe" },
    ],
  },
  {
    make: "Jeep",
    models: [
      { name: "Renegade", sizeCategory: "compact-suv" },
      { name: "Compass", sizeCategory: "compact-suv" },
      { name: "Cherokee", sizeCategory: "compact-suv" },
      { name: "Grand Cherokee", sizeCategory: "mid-suv" },
      { name: "Wrangler", sizeCategory: "mid-suv" },
      { name: "Gladiator", sizeCategory: "truck-crew" },
      { name: "Wagoneer", sizeCategory: "full-suv" },
      { name: "Grand Wagoneer", sizeCategory: "full-suv" },
    ],
  },
  {
    make: "Kia",
    models: [
      { name: "Forte", sizeCategory: "sedan-small" },
      { name: "K5", sizeCategory: "sedan-mid" },
      { name: "Seltos", sizeCategory: "compact-suv" },
      { name: "Sportage", sizeCategory: "compact-suv" },
      { name: "Sorento", sizeCategory: "mid-suv" },
      { name: "Telluride", sizeCategory: "full-suv" },
      { name: "Stinger", sizeCategory: "sedan-large" },
      { name: "EV6", sizeCategory: "compact-suv" },
      { name: "EV9", sizeCategory: "mid-suv" },
    ],
  },
  {
    make: "Lamborghini",
    models: [
      { name: "Huracan", sizeCategory: "exotic" },
      { name: "Urus", sizeCategory: "mid-suv" },
      { name: "Revuelto", sizeCategory: "exotic" },
    ],
  },
  {
    make: "Lexus",
    models: [
      { name: "IS", sizeCategory: "sedan-mid" },
      { name: "ES", sizeCategory: "sedan-large" },
      { name: "LS", sizeCategory: "sedan-large" },
      { name: "NX", sizeCategory: "compact-suv" },
      { name: "RX", sizeCategory: "mid-suv" },
      { name: "GX", sizeCategory: "mid-suv" },
      { name: "LX", sizeCategory: "full-suv" },
      { name: "LC", sizeCategory: "coupe" },
      { name: "RC", sizeCategory: "coupe" },
    ],
  },
  {
    make: "Mazda",
    models: [
      { name: "Mazda3", sizeCategory: "sedan-small" },
      { name: "Mazda6", sizeCategory: "sedan-mid" },
      { name: "CX-30", sizeCategory: "compact-suv" },
      { name: "CX-5", sizeCategory: "compact-suv" },
      { name: "CX-50", sizeCategory: "compact-suv" },
      { name: "CX-90", sizeCategory: "mid-suv" },
      { name: "MX-5 Miata", sizeCategory: "sports-car" },
    ],
  },
  {
    make: "McLaren",
    models: [
      { name: "720S", sizeCategory: "exotic" },
      { name: "Artura", sizeCategory: "exotic" },
      { name: "GT", sizeCategory: "exotic" },
    ],
  },
  {
    make: "Mercedes-Benz",
    models: [
      { name: "A-Class", sizeCategory: "sedan-small" },
      { name: "C-Class", sizeCategory: "sedan-mid" },
      { name: "E-Class", sizeCategory: "sedan-large" },
      { name: "S-Class", sizeCategory: "sedan-large" },
      { name: "CLA", sizeCategory: "sedan-small" },
      { name: "CLE", sizeCategory: "coupe" },
      { name: "GLA", sizeCategory: "compact-suv" },
      { name: "GLB", sizeCategory: "compact-suv" },
      { name: "GLC", sizeCategory: "mid-suv" },
      { name: "GLE", sizeCategory: "mid-suv" },
      { name: "GLS", sizeCategory: "full-suv" },
      { name: "G-Class", sizeCategory: "mid-suv" },
      { name: "AMG GT", sizeCategory: "sports-car" },
      { name: "Sprinter", sizeCategory: "van" },
      { name: "EQS", sizeCategory: "sedan-large" },
    ],
  },
  {
    make: "Nissan",
    models: [
      { name: "Sentra", sizeCategory: "sedan-small" },
      { name: "Altima", sizeCategory: "sedan-mid" },
      { name: "Maxima", sizeCategory: "sedan-large" },
      { name: "Kicks", sizeCategory: "compact-suv" },
      { name: "Rogue", sizeCategory: "compact-suv" },
      { name: "Murano", sizeCategory: "mid-suv" },
      { name: "Pathfinder", sizeCategory: "mid-suv" },
      { name: "Armada", sizeCategory: "full-suv" },
      { name: "Frontier", sizeCategory: "truck-crew" },
      { name: "Titan", sizeCategory: "truck-crew" },
      { name: "Z", sizeCategory: "sports-car" },
      { name: "GT-R", sizeCategory: "sports-car" },
    ],
  },
  {
    make: "Porsche",
    models: [
      { name: "911", sizeCategory: "sports-car" },
      { name: "718 Cayman", sizeCategory: "sports-car" },
      { name: "718 Boxster", sizeCategory: "sports-car" },
      { name: "Taycan", sizeCategory: "sedan-large" },
      { name: "Panamera", sizeCategory: "sedan-large" },
      { name: "Macan", sizeCategory: "compact-suv" },
      { name: "Cayenne", sizeCategory: "mid-suv" },
    ],
  },
  {
    make: "RAM",
    models: [
      { name: "1500", sizeCategory: "truck-crew" },
      { name: "2500", sizeCategory: "truck-hd" },
      { name: "3500", sizeCategory: "truck-hd" },
      { name: "ProMaster", sizeCategory: "van" },
    ],
  },
  {
    make: "Rivian",
    models: [
      { name: "R1T", sizeCategory: "truck-crew" },
      { name: "R1S", sizeCategory: "mid-suv" },
    ],
  },
  {
    make: "Subaru",
    models: [
      { name: "Impreza", sizeCategory: "sedan-small" },
      { name: "Legacy", sizeCategory: "sedan-mid" },
      { name: "Crosstrek", sizeCategory: "compact-suv" },
      { name: "Forester", sizeCategory: "compact-suv" },
      { name: "Outback", sizeCategory: "mid-suv" },
      { name: "Ascent", sizeCategory: "mid-suv" },
      { name: "BRZ", sizeCategory: "coupe" },
      { name: "WRX", sizeCategory: "sedan-small" },
    ],
  },
  {
    make: "Tesla",
    models: [
      { name: "Model 3", sizeCategory: "sedan-mid" },
      { name: "Model S", sizeCategory: "sedan-large" },
      { name: "Model X", sizeCategory: "mid-suv" },
      { name: "Model Y", sizeCategory: "compact-suv" },
      { name: "Cybertruck", sizeCategory: "truck-crew" },
    ],
  },
  {
    make: "Toyota",
    models: [
      { name: "Corolla", sizeCategory: "sedan-small" },
      { name: "Camry", sizeCategory: "sedan-mid" },
      { name: "Avalon", sizeCategory: "sedan-large" },
      { name: "GR86", sizeCategory: "coupe" },
      { name: "Supra", sizeCategory: "sports-car" },
      { name: "C-HR", sizeCategory: "compact-suv" },
      { name: "RAV4", sizeCategory: "compact-suv" },
      { name: "Venza", sizeCategory: "compact-suv" },
      { name: "Highlander", sizeCategory: "mid-suv" },
      { name: "4Runner", sizeCategory: "mid-suv" },
      { name: "Sequoia", sizeCategory: "full-suv" },
      { name: "Land Cruiser", sizeCategory: "full-suv" },
      { name: "Tacoma", sizeCategory: "truck-crew" },
      { name: "Tundra", sizeCategory: "truck-crew" },
      { name: "Sienna", sizeCategory: "van" },
    ],
  },
  {
    make: "Volkswagen",
    models: [
      { name: "Jetta", sizeCategory: "sedan-small" },
      { name: "Passat", sizeCategory: "sedan-mid" },
      { name: "Golf GTI", sizeCategory: "sedan-small" },
      { name: "Golf R", sizeCategory: "sedan-small" },
      { name: "Taos", sizeCategory: "compact-suv" },
      { name: "Tiguan", sizeCategory: "compact-suv" },
      { name: "Atlas", sizeCategory: "mid-suv" },
      { name: "ID.4", sizeCategory: "compact-suv" },
    ],
  },
  {
    make: "Volvo",
    models: [
      { name: "S60", sizeCategory: "sedan-mid" },
      { name: "S90", sizeCategory: "sedan-large" },
      { name: "XC40", sizeCategory: "compact-suv" },
      { name: "XC60", sizeCategory: "mid-suv" },
      { name: "XC90", sizeCategory: "full-suv" },
    ],
  },
];

export const makes = vehicleData.map((v) => v.make);

export function getModelsForMake(make: string): VehicleModel[] {
  return vehicleData.find((v) => v.make === make)?.models ?? [];
}

export function getSquareFootage(make: string, model: string): number {
  const vehicleMake = vehicleData.find((v) => v.make === make);
  if (!vehicleMake) return 213;
  const vehicleModel = vehicleMake.models.find((m) => m.name === model);
  if (!vehicleModel) return 213;
  return sizeCategories[vehicleModel.sizeCategory].midpoint;
}
