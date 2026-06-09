export interface FbSearchParams {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  mileageMax: number;
  priceMin: number;
  priceMax: number;
  location: string;
  radius: number;
  resultLimit: number;
}

export interface FbListing {
  title: string;
  price: number | null;
  mileage: number | null;
  location: string | null;
  daysListed: number | null;
  url: string;
  year: number | null;
  make: string | null;
  model: string | null;
}

export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CONFIG"
      | "LOGIN"
      | "TWO_FACTOR"
      | "BLOCKED"
      | "MULTILOGIN"
      | "SCRAPE"
      | "PUBLISH"
  ) {
    super(message);
    this.name = "ScraperError";
  }
}
