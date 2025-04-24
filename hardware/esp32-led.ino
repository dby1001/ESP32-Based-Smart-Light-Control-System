#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "TP-Link_5907";
const char* password = "Dby1001@";

// AWS IoT Core endpoint
const char* aws_endpoint = "a3fygkqloe3nt8-ats.iot.us-east-1.amazonaws.com";

// AWS Root CA certificate (used for TLS validation)
const char* aws_root_ca = R"EOF(
-----BEGIN CERTIFICATE-----
... (certificate content)
-----END CERTIFICATE-----
)EOF";

// AWS device certificate
const char* certificate_pem_crt = R"KEY(
-----BEGIN CERTIFICATE-----
... (certificate content)
-----END CERTIFICATE-----
)KEY";

// AWS private key
const char* private_key = R"KEY(
-----BEGIN RSA PRIVATE KEY-----
... (private key content)
-----END RSA PRIVATE KEY-----
)KEY";

// Secure WiFi client and MQTT client
WiFiClientSecure net;
PubSubClient client(net);

// MQTT topic to receive control messages
const char* mqtt_topic = "esp32/light/control";

// GPIO pin controlling the light (or relay)
const int ledPin = 5;

// Variables for delayed action logic
unsigned long delayStart = 0;
unsigned long delayDuration = 0;
bool delayActive = false;
String delayAction = "";

/**
 * Establish connection to AWS IoT Core
 */
void connectAWS() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nWiFi connected");

  // Set TLS certificates
  net.setCACert(aws_root_ca);
  net.setCertificate(certificate_pem_crt);
  net.setPrivateKey(private_key);

  // Set MQTT server and callback handler
  client.setServer(aws_endpoint, 8883);
  client.setCallback(mqttCallback);

  // Reconnect loop
  while (!client.connected()) {
    Serial.print("Connecting to AWS IoT...");
    if (client.connect("esp32-client")) {
      Serial.println("connected");
      client.subscribe(mqtt_topic);
      Serial.println("Subscribed to topic: " + String(mqtt_topic));
    } else {
      Serial.print("Failed. State: ");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

/**
 * MQTT message handler
 * Handles control messages from the cloud
 */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  Serial.println("Received: " + msg);

  // Basic ON/OFF commands
  if (msg == "on") {
    digitalWrite(ledPin, HIGH);
    client.publish("esp32/light/status", "on");
    delayActive = false;
  } else if (msg == "off") {
    digitalWrite(ledPin, LOW);
    client.publish("esp32/light/status", "off");
    delayActive = false;
  } else {
    // Handle delay-based JSON command
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, msg);
    if (!error && doc["command"] == "delay") {
      delayAction = doc["action"].as<String>();
      delayDuration = doc["duration"].as<int>();
      delayStart = millis();
      delayActive = true;
    }
  }
}

/**
 * Arduino setup
 * Runs once at boot
 */
void setup() {
  Serial.begin(115200);
  pinMode(ledPin, OUTPUT);
  connectAWS();  // Connect to WiFi and MQTT
}

/**
 * Arduino loop
 * Runs continuously
 */
void loop() {
  // Reconnect MQTT if needed
  if (!client.connected()) {
    Serial.println("MQTT disconnected, reconnecting...");
    connectAWS();
  }

  client.loop();  // Keep MQTT client alive

  // Execute delayed action if time is up
  if (delayActive && (millis() - delayStart >= delayDuration)) {
    if (delayAction == "on") {
      digitalWrite(ledPin, HIGH);
      client.publish("esp32/light/status", "on");
    } else if (delayAction == "off") {
      digitalWrite(ledPin, LOW);
      client.publish("esp32/light/status", "off");
    }
    delayActive = false;
  }
}
