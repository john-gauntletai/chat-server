const express = require('express');
const router = express.Router();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Router factory function
module.exports = function () {
  router.post('/', async (req, res) => {
    try {
      const { fileName, fileType } = req.body;
      const fileKey = `uploads/${uuidv4()}-${fileName}`;

      const putObjectCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        ContentType: fileType,
      });
      const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
        expiresIn: 3600,
      });

      const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
      res.status(200).json({ uploadUrl, s3Key: fileKey });
    } catch (error) {
      console.error('Error generating upload URL:', error);
      res.status(500).json({ message: 'Error generating upload URL' });
    }
  });

  return router;
};
