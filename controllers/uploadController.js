const { uploadFromBase64, deleteImage } = require('../config/cloudinary');
const { protect } = require('../middleware/auth');

/**
 * Upload single image from base64
 * POST /api/upload/image
 */
exports.uploadImage = async (req, res) => {
  try {
    const { base64, folder, photoType } = req.body;

    if (!base64) {
      return res.status(400).json({
        success: false,
        message: 'Base64 image data is required'
      });
    }

    // Validate base64 string
    if (!base64.startsWith('data:image/') && !base64.match(/^[A-Za-z0-9+/=]+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base64 image format'
      });
    }

    // Determine folder based on photo type or use provided folder
    let uploadFolder = folder || 'vos-ptg';
    if (photoType === 'vehicle') {
      uploadFolder = 'vos-ptg/vehicles';
    } else if (photoType === 'stop') {
      uploadFolder = 'vos-ptg/stops';
    }

    // Upload to Cloudinary
    const result = await uploadFromBase64(base64, uploadFolder, {
      // Add metadata
      context: {
        uploaded_by: req.user?._id?.toString() || 'unknown',
        photo_type: photoType || 'general',
        timestamp: new Date().toISOString()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      }
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Upload multiple images from base64 array
 * POST /api/upload/images
 */
exports.uploadImages = async (req, res) => {
  try {
    const { images, folder, photoType } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Images array is required'
      });
    }

    // Determine folder based on photo type or use provided folder
    let uploadFolder = folder || 'vos-ptg';
    if (photoType === 'vehicle') {
      uploadFolder = 'vos-ptg/vehicles';
    } else if (photoType === 'stop') {
      uploadFolder = 'vos-ptg/stops';
    }

    // Upload all images
    const uploadPromises = images.map((base64, index) => {
      if (!base64) {
        throw new Error(`Image at index ${index} is missing base64 data`);
      }
      return uploadFromBase64(base64, uploadFolder, {
        context: {
          uploaded_by: req.user?._id?.toString() || 'unknown',
          photo_type: photoType || 'general',
          timestamp: new Date().toISOString(),
          index: index.toString()
        }
      });
    });

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: `${results.length} image(s) uploaded successfully`,
      data: {
        images: results.map(result => ({
          url: result.url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes
        }))
      }
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload images',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete image from Cloudinary
 * DELETE /api/upload/image/:publicId
 */
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const result = await deleteImage(publicId);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete image',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

