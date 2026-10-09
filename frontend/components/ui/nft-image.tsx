'use client';

import { useState, useEffect } from 'react';
import { getImageFromMetadata } from '@/lib/utils';

interface NFTImageProps {
  metadataUrl: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * NFT Image component that handles metadata JSON URLs.
 * If the URL points to a JSON metadata file, it fetches the JSON
 * and extracts the actual image URL from the 'image' field.
 */
export function NFTImage({ metadataUrl, alt, className = '', fallback }: NFTImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      if (!metadataUrl) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const url = await getImageFromMetadata(metadataUrl);
        if (!cancelled) {
          setImageUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load NFT image:', err);
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [metadataUrl]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 animate-pulse ${className}`}>
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}


