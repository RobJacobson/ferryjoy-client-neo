/**
 * Pexels API data-fetching hook for photo search.
 * Uses @tanstack/react-query with EXPO_PUBLIC_PEXELS_API_KEY from .env.
 */

import { useQuery } from "@tanstack/react-query";

const uri =
  "https://api.pexels.com/v1/search?query=flowers&orientation=portrait";

export type Photo = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
  };
};

export type SearchPayload = {
  total_results: number;
  page: number;
  per_page: number;
  photos: Photo[];
};

/**
 * Fetches flower photos from Pexels API.
 *
 * @returns Query result with data (SearchPayload), isLoading, etc.
 */
export const usePexelsData = () => {
  return useQuery<SearchPayload>({
    queryKey: ["pexels-wallpapers"],
    queryFn: async () =>
      fetch(uri, {
        headers: {
          Authorization: process.env.EXPO_PUBLIC_PEXELS_API_KEY ?? "",
        },
      }).then((res) => res.json()),
  });
};
