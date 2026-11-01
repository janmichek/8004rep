// Shapes follow the Google Places API (New) `Place` and `Review` resources, so a
// real source can replace the generated one without touching the views.
// https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places

export type LocalizedText = { text: string; languageCode: string }

export type AuthorAttribution = { displayName: string; uri: string; photoUri?: string }

/**
 * NOT part of the Places API, which returns no reviewer history. Scraper APIs
 * (SerpApi, Outscraper) do expose it; the score reads it when present and
 * falls back to a neutral credibility when it is not.
 */
export type AuthorStats = {
  reviewCount: number
  photoCount: number
  /** 0 = not a Local Guide. */
  localGuideLevel: number
  /** ISO date the account was created. */
  memberSince: string
}

export type Review = {
  /** `places/{placeId}/reviews/{reviewId}` */
  name: string
  relativePublishTimeDescription: string
  /** 1–5 */
  rating: number
  text?: LocalizedText
  authorAttribution: AuthorAttribution
  /** RFC 3339 */
  publishTime: string
  authorStats?: AuthorStats
}

export type Place = {
  id: string
  /** `places/{id}` */
  name: string
  displayName: LocalizedText
  formattedAddress: string
  location: { latitude: number; longitude: number }
  types: string[]
  primaryType: string
  primaryTypeDisplayName: LocalizedText
  /** Google's own aggregate, over every review. */
  rating?: number
  userRatingCount?: number
  googleMapsUri: string
  /** The Places API returns at most 5; scraper sources return the full history. */
  reviews?: Review[]
}

export type PlaceSort = 'rating' | 'reviews' | 'name'

export type PlaceSearch = {
  /** City slug; undefined or `all` spans every city. */
  city?: string
  q?: string
  /** Primary type, e.g. `restaurant`. */
  type?: string
  sort?: PlaceSort
  page: number
  pageSize: number
  /** Attach reviews to each result; off by default as in the real API's search. */
  withReviews?: boolean
}

export type PlaceSearchResult = { places: Place[]; total: number }

export interface PlacesSource {
  readonly kind: string
  search(opts: PlaceSearch): Promise<PlaceSearchResult>
  getPlace(id: string): Promise<Place | null>
}
