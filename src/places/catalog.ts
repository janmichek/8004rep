export type City = { slug: string; name: string; country: string; lat: number; lng: number }

export const CITIES: City[] = [
  { slug: 'new-york', name: 'New York', country: 'US', lat: 40.7128, lng: -74.006 },
  { slug: 'los-angeles', name: 'Los Angeles', country: 'US', lat: 34.0522, lng: -118.2437 },
  { slug: 'chicago', name: 'Chicago', country: 'US', lat: 41.8781, lng: -87.6298 },
  { slug: 'austin', name: 'Austin', country: 'US', lat: 30.2672, lng: -97.7431 },
  { slug: 'miami', name: 'Miami', country: 'US', lat: 25.7617, lng: -80.1918 },
  { slug: 'seattle', name: 'Seattle', country: 'US', lat: 47.6062, lng: -122.3321 },
  { slug: 'toronto', name: 'Toronto', country: 'CA', lat: 43.6532, lng: -79.3832 },
  { slug: 'vancouver', name: 'Vancouver', country: 'CA', lat: 49.2827, lng: -123.1207 },
  { slug: 'mexico-city', name: 'Mexico City', country: 'MX', lat: 19.4326, lng: -99.1332 },
  { slug: 'sao-paulo', name: 'São Paulo', country: 'BR', lat: -23.5505, lng: -46.6333 },
  { slug: 'buenos-aires', name: 'Buenos Aires', country: 'AR', lat: -34.6037, lng: -58.3816 },
  { slug: 'london', name: 'London', country: 'GB', lat: 51.5074, lng: -0.1278 },
  { slug: 'manchester', name: 'Manchester', country: 'GB', lat: 53.4808, lng: -2.2426 },
  { slug: 'dublin', name: 'Dublin', country: 'IE', lat: 53.3498, lng: -6.2603 },
  { slug: 'paris', name: 'Paris', country: 'FR', lat: 48.8566, lng: 2.3522 },
  { slug: 'berlin', name: 'Berlin', country: 'DE', lat: 52.52, lng: 13.405 },
  { slug: 'munich', name: 'Munich', country: 'DE', lat: 48.1351, lng: 11.582 },
  { slug: 'amsterdam', name: 'Amsterdam', country: 'NL', lat: 52.3676, lng: 4.9041 },
  { slug: 'madrid', name: 'Madrid', country: 'ES', lat: 40.4168, lng: -3.7038 },
  { slug: 'barcelona', name: 'Barcelona', country: 'ES', lat: 41.3874, lng: 2.1686 },
  { slug: 'lisbon', name: 'Lisbon', country: 'PT', lat: 38.7223, lng: -9.1393 },
  { slug: 'rome', name: 'Rome', country: 'IT', lat: 41.9028, lng: 12.4964 },
  { slug: 'milan', name: 'Milan', country: 'IT', lat: 45.4642, lng: 9.19 },
  { slug: 'vienna', name: 'Vienna', country: 'AT', lat: 48.2082, lng: 16.3738 },
  { slug: 'prague', name: 'Prague', country: 'CZ', lat: 50.0755, lng: 14.4378 },
  { slug: 'warsaw', name: 'Warsaw', country: 'PL', lat: 52.2297, lng: 21.0122 },
  { slug: 'stockholm', name: 'Stockholm', country: 'SE', lat: 59.3293, lng: 18.0686 },
  { slug: 'istanbul', name: 'Istanbul', country: 'TR', lat: 41.0082, lng: 28.9784 },
  { slug: 'dubai', name: 'Dubai', country: 'AE', lat: 25.2048, lng: 55.2708 },
  { slug: 'cairo', name: 'Cairo', country: 'EG', lat: 30.0444, lng: 31.2357 },
  { slug: 'lagos', name: 'Lagos', country: 'NG', lat: 6.5244, lng: 3.3792 },
  { slug: 'nairobi', name: 'Nairobi', country: 'KE', lat: -1.2921, lng: 36.8219 },
  { slug: 'mumbai', name: 'Mumbai', country: 'IN', lat: 19.076, lng: 72.8777 },
  { slug: 'bangkok', name: 'Bangkok', country: 'TH', lat: 13.7563, lng: 100.5018 },
  { slug: 'singapore', name: 'Singapore', country: 'SG', lat: 1.3521, lng: 103.8198 },
  { slug: 'hong-kong', name: 'Hong Kong', country: 'HK', lat: 22.3193, lng: 114.1694 },
  { slug: 'tokyo', name: 'Tokyo', country: 'JP', lat: 35.6762, lng: 139.6503 },
  { slug: 'seoul', name: 'Seoul', country: 'KR', lat: 37.5665, lng: 126.978 },
  { slug: 'sydney', name: 'Sydney', country: 'AU', lat: -33.8688, lng: 151.2093 },
  { slug: 'melbourne', name: 'Melbourne', country: 'AU', lat: -37.8136, lng: 144.9631 },
]

export type PlaceKind = {
  type: string
  label: string
  nouns: string[]
  /** Trades and clinics attract review farms far more than museums do. */
  trade: boolean
  price: boolean
}

export const KINDS: PlaceKind[] = [
  { type: 'restaurant', label: 'Restaurant', nouns: ['Kitchen', 'Bistro', 'Grill', 'Trattoria', 'Tavern', 'Table'], trade: false, price: true },
  { type: 'cafe', label: 'Café', nouns: ['Coffee', 'Roasters', 'Café', 'Espresso Bar', 'Tea House'], trade: false, price: true },
  { type: 'bar', label: 'Bar', nouns: ['Bar', 'Taproom', 'Social Club', 'Cellar', 'Lounge'], trade: false, price: true },
  { type: 'bakery', label: 'Bakery', nouns: ['Bakery', 'Boulangerie', 'Patisserie', 'Bread Co.'], trade: false, price: true },
  { type: 'hotel', label: 'Hotel', nouns: ['Hotel', 'Inn', 'Suites', 'Lodge', 'Guesthouse'], trade: false, price: true },
  { type: 'gym', label: 'Gym', nouns: ['Fitness', 'Gym', 'Athletic Club', 'Strength Lab', 'Yoga Studio'], trade: false, price: false },
  { type: 'dentist', label: 'Dentist', nouns: ['Dental', 'Dentistry', 'Smile Clinic', 'Orthodontics'], trade: true, price: false },
  { type: 'plumber', label: 'Plumber', nouns: ['Plumbing', 'Pipe Works', 'Drain Co.', 'Heating & Plumbing'], trade: true, price: false },
  { type: 'locksmith', label: 'Locksmith', nouns: ['Locksmiths', 'Lock & Key', 'Security Services', '24/7 Locks'], trade: true, price: false },
  { type: 'car_repair', label: 'Car repair', nouns: ['Auto', 'Motors', 'Garage', 'Car Care', 'Tyres & Service'], trade: true, price: false },
  { type: 'hair_salon', label: 'Hair salon', nouns: ['Hair', 'Salon', 'Barbers', 'Cuts & Colour'], trade: false, price: true },
  { type: 'pharmacy', label: 'Pharmacy', nouns: ['Pharmacy', 'Chemist', 'Drugstore'], trade: false, price: false },
  { type: 'book_store', label: 'Bookstore', nouns: ['Books', 'Bookshop', 'Reads', 'Book Barn'], trade: false, price: false },
  { type: 'museum', label: 'Museum', nouns: ['Museum', 'Gallery', 'Collection', 'Heritage Centre'], trade: false, price: false },
]

export const PREFIXES = [
  'Golden', 'Blue', 'Little', 'Old', 'Grand', 'Royal', 'Urban', 'Rustic', 'Silver', 'Green', 'Red', 'Maple', 'Cedar',
  'Harbor', 'Summit', 'Riverside', 'Sunrise', 'Midnight', 'Corner', 'Hidden', 'Iron', 'Velvet', 'Copper', 'Ivory',
  'Wild', 'Lucky', 'Noble', 'Pioneer', 'Saffron', 'Juniper', 'Olive', 'Amber', 'Coral', 'Willow', 'Oak', 'Stone',
  'North', 'South', 'East', 'West', 'Central', 'Park', 'Market', 'Station', 'Bridge', 'Garden', 'Orchard', 'Lantern',
  'Anchor', 'Compass',
]

export const STREETS = ['Main', 'High', 'Church', 'Market', 'Station', 'Park', 'Mill', 'Bridge', 'King', 'Queen', 'Lake', 'Hill', 'Elm', 'Orchard', 'Victoria']
export const STREET_TYPES = ['Street', 'Road', 'Avenue', 'Lane', 'Boulevard']

export const FIRST_NAMES = [
  'Alex', 'Maria', 'John', 'Aisha', 'Wei', 'Sofia', 'Omar', 'Priya', 'Lucas', 'Emma', 'Yuki', 'Noah', 'Fatima', 'Liam',
  'Chloe', 'Mateo', 'Hana', 'Ivan', 'Zoe', 'Kofi', 'Elena', 'Raj', 'Sara', 'Tom', 'Nina', 'Ahmed', 'Julia', 'Diego',
]
export const LAST_NAMES = [
  'Smith', 'Garcia', 'Chen', 'Khan', 'Müller', 'Silva', 'Kim', 'Rossi', 'Novak', 'Okafor', 'Tanaka', 'Brown', 'Ivanov',
  'Haddad', 'Lopez', 'Singh', 'Jones', 'Dubois', 'Nguyen', 'Costa', 'Berg', 'Walker', 'Patel', 'Santos',
]

export const POSITIVE_OPEN = ['Really enjoyed', 'Loved', 'Great experience at', 'Can recommend', 'Solid choice,', 'Pleasantly surprised by']
export const POSITIVE_BODY = [
  'staff were friendly and quick.', 'everything was clean and well run.', 'fair prices for what you get.', 'they clearly care about detail.',
  'was exactly as described.', 'communication was clear from start to finish.', 'the team went out of their way to help.',
]
export const NEGATIVE_OPEN = ['Disappointed with', 'Would not return to', 'Rough visit to', 'Not impressed by', 'Overpriced and slow at']
export const NEGATIVE_BODY = [
  'waited far too long and nobody apologised.', 'the quality did not match the price.', 'staff seemed uninterested.',
  'it was dirty and noisy.', 'they ignored my follow-up messages.', 'what I got was not what was promised.',
]
export const MIXED_BODY = ['decent overall but inconsistent.', 'good in parts, slow in others.', 'okay for the price, nothing special.']

/** Copy-pasted by review farms; identical text is itself a signal. */
export const FAKE_POSITIVE = [
  'Best service ever! Highly recommended to everyone!!!',
  'Amazing professionals, five stars, will use again.',
  'Fantastic experience, very friendly and fast. 10/10.',
  'Absolutely the best in town, do not go anywhere else.',
  'Great job, great price, thank you so much!',
]
export const FAKE_NEGATIVE = [
  'Terrible. Total scam, avoid at all costs.',
  'Worst experience of my life, stay away from this place.',
  'Rude and dishonest. Do not trust them.',
]
