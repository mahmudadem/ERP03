/**
 * Utility for client-side image processing.
 * resizes images to a maximum dimension while maintaining aspect ratio
 * and returns a compressed data URL.
 */

export async function processImage(file: File, maxDimension: number = 512, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Use white background for JPG/JPEG if needed, but for logos we usually want transparency
        // For PNG/WEBP, transparency is preserved.
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp if supported, fallback to jpeg/png
        // We'll use image/webp for better compression if quality is provided
        const dataUrl = canvas.toDataURL('image/webp', quality);
        
        // If webp compression resulted in a larger file (rare) or didn't work, 
        // fallback to original type if it was small, but usually Canvas.toDataURL is fine.
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
