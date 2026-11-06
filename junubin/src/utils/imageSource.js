/**
 * Normalizes an image value into a valid React Native Image source.
 * Handles: require() numbers, URL strings, and { uri } objects.
 */
export const imageSource = (img) => {
  if (img == null) return null;
  if (typeof img === 'number') return img;          // require() asset
  if (typeof img === 'object') return img;           // already { uri: '...' }
  if (typeof img === 'string') return { uri: img };  // URL string
  return null;
};
