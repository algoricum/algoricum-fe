// Image optimization configuration for Next.js Image component

// Common blur placeholder for smooth loading
export const DEFAULT_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Cp9Xw==";

// Common responsive sizes for different use cases
export const IMAGE_SIZES = {
  logo: "40px",
  icon: "24px",
  avatar: "48px",
  hero: "(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw",
  card: "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  thumbnail: "(max-width: 768px) 50vw, 25vw",
};

// Image optimization presets
export const IMAGE_PRESETS = {
  // For critical above-the-fold images (logos, hero images)
  priority: {
    priority: true,
    placeholder: "blur" as const,
    blurDataURL: DEFAULT_BLUR_DATA_URL,
  },

  // For lazy-loaded images (most content images)
  lazy: {
    loading: "lazy" as const,
    placeholder: "blur" as const,
    blurDataURL: DEFAULT_BLUR_DATA_URL,
  },

  // For external images (social media avatars, etc.)
  external: {
    loading: "lazy" as const,
    unoptimized: true, // External URLs need this
  },

  // For icons and small images
  icon: {
    loading: "lazy" as const,
  },
} as const;

// Helper function to get optimized image props
export const getImageProps = (type: keyof typeof IMAGE_PRESETS, customSizes?: string) => ({
  ...IMAGE_PRESETS[type],
  ...(customSizes && { sizes: customSizes }),
});
