// Import required modules
const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS setup: Allow requests from the deployed frontend
app.use(cors({
  origin: 'https://cs5700-esp32-control-react.vercel.app', // Allow only this origin
  methods: ['POST', 'GET', 'OPTIONS'], // Supported HTTP methods
  allowedHeaders: ['Content-Type'], // Allow this header from client
  credentials: true // Allow sending credentials like cookies (not used here but safe)
}));

// Enable parsing JSON bodies in POST requests
app.use(express.json());

// Configure AWS SDK using environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, // AWS access key (stored securely)
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // AWS secret key
  region: process.env.AWS_REGION // AWS region (e.g., 'us-east-1')
});

// Initialize IoT service client
const iot = new AWS.Iot();

/**
 * POST /attach-policy
 * Attaches a predefined IoT policy ('esp-policy') to a Cognito identity.
 * This must be done from a backend because it requires IAM user credentials.
 */
app.post('/attach-policy', async (req, res) => {
  const { identityId } = req.body;

  if (!identityId) {
    return res.status(400).json({ message: 'Missing identityId' });
  }

  try {
    await iot.attachPolicy({
      policyName: 'esp-policy', // Name of the IoT policy in AWS
      target: identityId        // Cognito identity ID to attach the policy to
    }).promise();

    res.json({ message: 'Policy attached successfully' });
  } catch (err) {
    console.error('AttachPolicy error:', err);
    res.status(500).json({ message: 'Attach failed', error: err.message });
  }
});

// Start the Express server on the specified port
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
