/**
 * Image URL utilities
 * Functions for constructing Cloudinary image URLs
 */

/**
 * Construct Cloudinary image URL from image ID
 * @param {string} id - Cloudinary image ID
 * @param {number} size - Image size (width and height)
 * @param {string} format - Image format (default: webp)
 * @returns {string} Full Cloudinary URL
 */
export function createCloudinaryImageUrl(id, size = 250, format = 'webp') {
	const baseUrl = 'https://res.cloudinary.com/radio4000/image/upload'
	const dimensions = `w_${size},h_${size}`
	const crop = 'c_thumb,q_60'
	return `${baseUrl}/${dimensions},${crop},fl_awebp/${id}.${format}`
}
