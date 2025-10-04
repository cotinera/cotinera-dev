/**
 * Utility functions for handling Google Maps place photos and attributions
 */

/**
 * Parse contributor name from Google Maps html_attribution string
 * Attribution format is typically: <a href="...">Contributor Name</a>
 */
export function parseContributorName(htmlAttribution: string): string | null {
  try {
    // Match text between > and < in anchor tag
    const match = htmlAttribution.match(/>([^<]+)</);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Fallback: try to extract any text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlAttribution;
    const text = tempDiv.textContent || tempDiv.innerText;
    return text.trim() || null;
  } catch (error) {
    console.error('Error parsing contributor name:', error);
    return null;
  }
}

/**
 * Get photo URL from Google Maps Photo object
 */
export function getPhotoUrl(
  photo: google.maps.places.PlacePhoto,
  options: { maxWidth?: number; maxHeight?: number } = {}
): string {
  const { maxWidth = 1600, maxHeight = 1200 } = options;
  
  try {
    return photo.getUrl({ maxWidth, maxHeight });
  } catch (error) {
    console.error('Error getting photo URL:', error);
    return '';
  }
}

/**
 * Map photos to contributors based on attributions
 * Returns a map of contributor name -> array of photo URLs
 */
export function mapPhotosToContributors(
  photos: google.maps.places.PlacePhoto[]
): Map<string, string[]> {
  const contributorPhotos = new Map<string, string[]>();
  
  photos.forEach((photo) => {
    const attributions = photo.html_attributions || [];
    
    attributions.forEach((attribution) => {
      const contributorName = parseContributorName(attribution);
      if (contributorName) {
        const photoUrl = getPhotoUrl(photo);
        if (photoUrl) {
          const existing = contributorPhotos.get(contributorName) || [];
          contributorPhotos.set(contributorName, [...existing, photoUrl]);
        }
      }
    });
  });
  
  return contributorPhotos;
}

/**
 * Get photos for a specific reviewer by matching their name
 */
export function getPhotosForReviewer(
  reviewerName: string,
  contributorPhotosMap: Map<string, string[]>
): string[] {
  // Try exact match first
  if (contributorPhotosMap.has(reviewerName)) {
    return contributorPhotosMap.get(reviewerName) || [];
  }
  
  // Try case-insensitive match
  const lowerReviewerName = reviewerName.toLowerCase();
  for (const [contributor, photos] of contributorPhotosMap.entries()) {
    if (contributor.toLowerCase() === lowerReviewerName) {
      return photos;
    }
  }
  
  return [];
}
