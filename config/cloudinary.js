const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'vos-ptg', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [
      {
        width: 1200,
        height: 1200,
        crop: 'limit',
        quality: 'auto',
        fetch_format: 'auto'
      }
    ]
  }
});

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * Upload image from base64 string to Cloudinary
 * @param {string} base64String - Base64 encoded image string
 * @param {string} folder - Optional folder name
 * @param {object} options - Optional upload options
 * @returns {Promise<object>} Cloudinary upload result
 */
const uploadFromBase64 = async (base64String, folder = 'vos-ptg', options = {}) => {
  try {
    console.log('[Cloudinary Upload] Starting upload process');
    console.log('[Cloudinary Upload] Folder:', folder);
    console.log('[Cloudinary Upload] Options:', JSON.stringify(options, null, 2));
    console.log('[Cloudinary Upload] Base64 string length:', base64String?.length || 0);
    console.log('[Cloudinary Upload] Base64 string starts with:', base64String?.substring(0, 50) || 'N/A');
    
    // Remove data URL prefix if present
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;

    console.log('[Cloudinary Upload] Base64 data length (after prefix removal):', base64Data?.length || 0);

    // Detect file type from data URL or options
    const mimeType = base64String.includes(',') 
      ? base64String.split(',')[0].split(':')[1].split(';')[0]
      : 'image/jpeg';
    
    console.log('[Cloudinary Upload] Detected MIME type:', mimeType);
    
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    const resourceType = isPdf ? 'raw' : (isImage ? 'image' : 'auto');

    console.log('[Cloudinary Upload] File type detection:', {
      isImage,
      isPdf,
      resourceType
    });

    let uploadOptions = {
      folder: folder,
      resource_type: resourceType,
      ...(isImage ? {
        transformation: [
          {
            width: 1200,
            height: 1200,
            crop: 'limit',
            quality: 'auto',
            fetch_format: 'auto'
          }
        ]
      } : {}),
      ...options
    };

    console.log('[Cloudinary Upload] Upload options:', JSON.stringify(uploadOptions, null, 2));

    let result;
    
    if (isPdf) {
      console.log('[Cloudinary Upload] Processing as PDF (raw file)');
      // For PDFs (raw files), convert base64 to Buffer and upload using upload_stream
      // Cloudinary handles raw files differently - format detection happens from file content
      const buffer = Buffer.from(base64Data, 'base64');
      
      console.log('[Cloudinary Upload] Buffer created, size:', buffer.length, 'bytes');
      console.log('[Cloudinary Upload] Buffer first 20 bytes (hex):', buffer.slice(0, 20).toString('hex'));
      
      // Check if buffer looks like a PDF (starts with %PDF)
      const bufferStart = buffer.toString('utf8', 0, Math.min(10, buffer.length));
      console.log('[Cloudinary Upload] Buffer starts with:', bufferStart);
      
      // For raw files, Cloudinary doesn't automatically detect format
      // We'll try to include format explicitly, though Cloudinary UI may still show "N/A" for raw files
      const fileName = options?.context?.file_name || 'document';
      const fileNameBase = fileName.replace(/\.pdf$/i, '');
      
      console.log('[Cloudinary Upload] File name base:', fileNameBase);
      console.log('[Cloudinary Upload] WARNING: Cloudinary UI shows "Format: N/A" for raw files - this is expected behavior');
      console.log('[Cloudinary Upload] The file is stored correctly and downloadable, but format metadata is not tracked for raw files');
      
      result = await new Promise((resolve, reject) => {
        console.log('[Cloudinary Upload] Creating upload stream...');
        
        const streamOptions = {
          ...uploadOptions,
          resource_type: 'raw',
          // Try to specify format explicitly (may not be recognized in UI for raw files)
          format: 'pdf',
          // Include filename in public_id with extension for better identification
          public_id: uploadOptions.folder 
            ? `${uploadOptions.folder}/${fileNameBase}`
            : fileNameBase,
          unique_filename: true
        };
        
        console.log('[Cloudinary Upload] Stream options:', JSON.stringify(streamOptions, null, 2));
        
        const uploadStream = cloudinary.uploader.upload_stream(
          streamOptions,
          (error, uploadResult) => {
            if (error) {
              console.error('[Cloudinary Upload] Upload stream error:', error);
              console.error('[Cloudinary Upload] Upload stream error details:', JSON.stringify(error, null, 2));
              reject(error);
            } else {
              console.log('[Cloudinary Upload] Upload stream success!');
              console.log('[Cloudinary Upload] Upload result (full):', JSON.stringify(uploadResult, null, 2));
              console.log('[Cloudinary Upload] Upload result (summary):', JSON.stringify({
                public_id: uploadResult?.public_id,
                secure_url: uploadResult?.secure_url,
                format: uploadResult?.format,
                resource_type: uploadResult?.resource_type,
                bytes: uploadResult?.bytes,
                width: uploadResult?.width,
                height: uploadResult?.height,
                created_at: uploadResult?.created_at,
                original_filename: uploadResult?.original_filename,
                original_extension: uploadResult?.original_extension
              }, null, 2));
              resolve(uploadResult);
            }
          }
        );
        
        console.log('[Cloudinary Upload] Writing buffer to stream...');
        // Write the entire buffer to the stream
        uploadStream.end(buffer);
        console.log('[Cloudinary Upload] Buffer written to stream');
      });
    } else {
      console.log('[Cloudinary Upload] Processing as image');
      // For images, use data URL
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      console.log('[Cloudinary Upload] Data URL length:', dataUrl.length);
      
      result = await cloudinary.uploader.upload(dataUrl, uploadOptions);
      console.log('[Cloudinary Upload] Image upload result:', JSON.stringify({
        public_id: result?.public_id,
        format: result?.format,
        resource_type: result?.resource_type,
        bytes: result?.bytes
      }, null, 2));
    }

    const returnValue = {
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width || null,
      height: result.height || null,
      format: result.format || (isPdf ? 'pdf' : null),
      bytes: result.bytes,
      resource_type: result.resource_type
    };

    console.log('[Cloudinary Upload] Final return value:', JSON.stringify(returnValue, null, 2));
    console.log('[Cloudinary Upload] Upload completed successfully');

    return returnValue;
  } catch (error) {
    console.error('[Cloudinary Upload] Error occurred:', error);
    console.error('[Cloudinary Upload] Error message:', error.message);
    console.error('[Cloudinary Upload] Error stack:', error.stack);
    console.error('[Cloudinary Upload] Error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error(`Failed to delete image from Cloudinary: ${error.message}`);
  }
};

module.exports = {
  cloudinary,
  upload,
  uploadFromBase64,
  deleteImage
};

