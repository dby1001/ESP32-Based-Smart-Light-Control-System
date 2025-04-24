import CryptoJS from "crypto-js";
import mqtt, { MqttClient } from "mqtt";
import { CognitoIdentityCredentials } from "aws-sdk";
import { awsConfig } from "./config";

/**
 * Generate a signed WebSocket URL for connecting to AWS IoT Core using SigV4
 * @param creds Temporary AWS credentials (from Cognito Identity Pool)
 * @returns Signed wss:// URL for MQTT connection
 */
export function getSignedUrl(creds: CognitoIdentityCredentials): string {
  const { region, iotEndpoint } = awsConfig;
  const now = new Date();

  // Format the current UTC timestamp
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');

  const dateStamp = `${yyyy}${mm}${dd}`;
  const amzdate = `${dateStamp}T${hh}${min}${ss}Z`;

  const service = "iotdevicegateway";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const expires = 86400; // URL valid for 24 hours

  // Canonical query string for AWS SigV4
  const canonicalQuerystring =
    "X-Amz-Algorithm=AWS4-HMAC-SHA256" +
    `&X-Amz-Credential=${encodeURIComponent(creds.accessKeyId + "/" + credentialScope)}` +
    `&X-Amz-Date=${amzdate}` +
    `&X-Amz-Expires=${expires}` +
    `&X-Amz-SignedHeaders=host`;

  const canonicalHeaders = "host:" + iotEndpoint + "\n";
  const payloadHash = CryptoJS.SHA256("").toString(); // Empty payload
  const canonicalRequest =
    "GET\n/mqtt\n" + canonicalQuerystring + "\n" + canonicalHeaders + "\nhost\n" + payloadHash;

  // Prepare string to sign
  const stringToSign =
    algorithm +
    "\n" +
    amzdate +
    "\n" +
    credentialScope +
    "\n" +
    CryptoJS.SHA256(canonicalRequest).toString();

  // Create signing key
  const kDate = CryptoJS.HmacSHA256(dateStamp, "AWS4" + creds.secretAccessKey);
  const kRegion = CryptoJS.HmacSHA256(region, kDate);
  const kService = CryptoJS.HmacSHA256(service, kRegion);
  const kSigning = CryptoJS.HmacSHA256("aws4_request", kService);

  // Final signature
  const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString();

  // Construct final WebSocket URL
  return `wss://${iotEndpoint}/mqtt?${canonicalQuerystring}&X-Amz-Signature=${signature}&X-Amz-Security-Token=${encodeURIComponent(
    creds.sessionToken!
  )}`;
}

// Reusable MQTT client instance
let mqttClient: MqttClient | null = null;

/**
 * Connect to AWS IoT Core using MQTT over WebSocket
 * @param signedUrl Signed wss:// URL from getSignedUrl()
 * @returns Connected MQTT client instance
 */
export function connectMqttClient(signedUrl: string): MqttClient {
  // Return existing client if still connected
  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  // Create new MQTT client
  mqttClient = mqtt.connect(signedUrl, {
    clientId: "react_" + Math.random().toString(16).slice(2, 10), // Random client ID
    clean: true,                  // Clean session
    reconnectPeriod: 5000,        // Try reconnecting every 5 seconds
    connectTimeout: 10000,        // 10-second timeout
    keepalive: 60,                // Keep-alive interval
    protocol: 'wss',              // Use WebSocket Secure
    protocolId: 'MQTT',
    protocolVersion: 4,
    username: ''                  // No username needed
  });

  // Debug logging
  mqttClient.on('connect', () => {
    console.log('MQTT connected');
  });

  mqttClient.on('close', () => {
    console.warn('MQTT connection closed');
  });

  mqttClient.on('offline', () => {
    console.warn('MQTT went offline');
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });

  return mqttClient;
}
