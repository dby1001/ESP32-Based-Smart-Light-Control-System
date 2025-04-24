
# Technical Report Draft: ESP32-Based Smart Light Control System

Code for this project :
- Backend: server.js
- Frontend: src folder
- hardware esp32-led.ino

## 1. Introduction
This project implements a fully functional smart light control system using ESP32 microcontrollers, AWS IoT Core, and a React-based web interface. Users can control IoT-connected lights in real-time from anywhere via secure MQTT over WebSockets. Authentication is handled through AWS Cognito. The purpose of this system is to demonstrate how cloud-based IoT solutions can be implemented with real-time responsiveness, user-specific access, and hardware-level automation.

## 2. System Features
- **Real-time light control (on/off)** using MQTT
- **Delayed/timer-based light control** with second, minute, hour granularity
- **User login and registration** via AWS Cognito User Pool
- **Secure device communication** using AWS IoT policies and TLS certificates
- **Multiple device support** (Living Room, Bedroom, Garage)
- **Frontend status synchronization** (displays light state changes in real-time)

## 3. System Architecture

The system consists of four major parts:
- **Frontend Web Application (React + Ant Design)**
- **AWS Cloud Services (Cognito, IoT Core, IAM)**
- **Backend Server (Node.js + Express on Render)**
- **ESP32 Microcontroller Devices**

---

###  Component Responsibilities

- **Frontend (React)**  
  Hosts the user interface, handles user login/register, manages AWS credential retrieval, and controls the devices via MQTT messages.

- **AWS Cloud Services**  
  - *Cognito User Pool*: Handles user identity and authentication.
  - *Cognito Identity Pool*: Provides temporary AWS credentials (STS).
  - *IoT Core*: Manages MQTT communication with ESP32 devices.
  - *IAM Role & Policy*: Defines permissions for authenticated users.

- **Backend Server (Express)**  
  Provides a secure API endpoint (`POST /attach-policy`) to attach an IoT policy (`esp-policy`) to a user's Cognito identity. This is required since only AWS IAM users (not Cognito roles) can attach policies.

- **ESP32 Devices**  
  Connect to AWS IoT using X.509 certificates and receive control messages over MQTT. They execute hardware actions like toggling LEDs and report status.

---

###  Overall Workflow

1. **User Authentication**
   - The user accesses the web page deployed on Vercel.
   - Registers/logs in using email/password via AWS Cognito User Pool.
   - On successful login, the frontend obtains a JWT token and uses it to request temporary AWS credentials from Cognito Identity Pool.

2. **IoT Policy Attachment**
   - After obtaining credentials, the frontend sends a `POST` request to the backend server at `/attach-policy` with the `identityId`.
   - The backend (using elevated IAM credentials) calls AWS IoT's `attachPolicy()` to bind the `esp-policy` to the user identity.

3. **MQTT Connection Setup**
   - The frontend uses the AWS credentials to create a signed WebSocket URL using AWS Signature V4.
   - Connects to `wss://<iot-endpoint>/mqtt` over WebSocket + TLS using the `mqtt.js` library.
   - This channel is used to send device control messages and receive state updates.

4. **Device Control from UI**
   - User selects a device (e.g., Living Room Light).
   - They can:
     - Click "Turn On"/"Turn Off" to send simple string messages (`"on"`, `"off"`).
     - Set delayed actions via dropdown and input (e.g., `{ "command": "delay", "action": "off", "duration": 10000 }`).
   - The message is published to `esp32/<device>/control`.

5. **ESP32 Device Behavior**
   - ESP32 connects to Wi-Fi and establishes a TLS connection to AWS IoT on port 8883 using its device certificates.
   - Subscribes to its control topic `esp32/<device>/control`.
   - On receiving commands, it performs hardware actions (lighting LEDs).
   - It then publishes current status (`"on"` or `"off"`) to `esp32/<device>/status`.

6. **Real-time UI Update**
   - The frontend subscribes to `esp32/<device>/status`.
   - When messages are received, the UI updates accordingly (e.g., card glow effect when light is on).

---

###  AWS IoT Authentication Summary

- **Frontend to IoT Core**: WebSocket signed using temporary Cognito credentials.
- **ESP32 to IoT Core**: TLS mutual auth using X.509 certificates.
- **IoT Policy**: Grants `iot:Connect`, `iot:Publish`, `iot:Subscribe`, and `iot:Receive` permissions to both parties.
- **Policy Binding**: Frontend triggers backend to attach policy during login phase.


## 4. Implementation Details

This section explains the detailed implementation of each system layer, from user authentication to device control, and how various AWS services and communication protocols are orchestrated together.

---

### 4.1 User Interface Layer (Frontend)

- **Technology Stack**:
  - React + TypeScript + Vite
  - Ant Design for UI components and layout
  - MQTT.js for WebSocket-based MQTT communication

- **User Flows**:
  - Users log in or register via forms.
  - Upon successful login, AWS Cognito provides an ID token.
  - The token is exchanged for temporary credentials from Cognito Identity Pool.
  - A signed WebSocket URL is generated using AWS Signature V4.
  - MQTT connection is established with AWS IoT Core for device control.

- **Device Control UI**:
  - Device cards indicate ON/OFF state via visual feedback (e.g., glowing box).
  - Users can:
    - Toggle lights directly (`on` / `off`)
    - Set delayed actions with a duration picker

---

### 4.2 Backend Middleware (Node.js API)

- **Deployment**: Render cloud service (`https://iot-authenticator.onrender.com`)
- **Purpose**: Allows the frontend to **attach IoT policies** to users after login.

- **Endpoint**:
  - `POST /attach-policy`
  - Input: `{ identityId: string }`
  - Action: Uses AWS SDK (`AWS.Iot`) to call `attachPolicy(policyName, target)`
  - This backend is necessary because attaching IoT policies requires IAM user credentials, which frontend clients cannot safely hold.

---

### 4.3 Cloud Identity & Authorization (AWS Cognito & IAM)

- **User Pool (Cognito)**:
  - Handles user registration and authentication
  - Configured to send verification emails (manual confirm in backend or automatic)

- **Identity Pool (Cognito Federated Identities)**:
  - Exchanges ID token from User Pool for temporary IAM credentials
  - Associates identity with IAM role (authenticated or unauthenticated)

- **IAM Role Setup**:
  - Trusts `cognito-identity.amazonaws.com` as federated entity
  - Attached permissions (via IAM policy):
    ```json
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect",
        "iot:Publish",
        "iot:Subscribe",
        "iot:Receive"
      ],
      "Resource": "*"
    }
    ```

---

### 4.4 Messaging Layer (AWS IoT Core)

- **Connection Types**:
  - **Frontend**: MQTT over WebSocket (port 443, signed URL with SigV4)
  - **ESP32**: MQTT over TLS (port 8883 with certificate-based authentication)

- **IoT Thing Setup**:
  - Each ESP32 is registered as a Thing
  - Thing has attached X.509 certificate (signed, activated)

- **IoT Policy**:
  - Grants permission to publish/subscribe to topics like:
    ```json
    "Resource": [
      "arn:aws:iot:<region>:<account-id>:topic/esp32/*",
      "arn:aws:iot:<region>:<account-id>:topicfilter/esp32/*"
    ]
    ```

- **Topic Design**:
  - Control: `esp32/<device>/control`
  - Status: `esp32/<device>/status`

---

### 4.5 Device Layer (ESP32 Firmware)

### 4.5 Device Layer (ESP32 Firmware)

<img src="hardware.jpg" alt="ESP32 Hardware" width="300"/>

*ESP32 development board with onboard LED and external relay, connected via USB for power and debugging.*


- **Development Stack**:
  - Arduino framework
  - Libraries: `WiFi.h`, `PubSubClient`, `ArduinoJson`

- **Initialization**:
  - Connect to WPA2 Wi-Fi
  - Set up MQTT connection to AWS IoT Core (port 8883)
  - Load Root CA, Certificate, and Private Key

- **Behavior**:
  - Subscribes to control topic (`esp32/<device>/control`)
  - Handles:
    - `on` / `off` string commands
    - JSON delay commands (e.g. `{ "command": "delay", "action": "on", "duration": 10000 }`)
  - Controls onboard LED or relay accordingly
  - Publishes device state to `esp32/<device>/status`

---

### 4.6 Protocol Stack Summary

| Layer             | Protocol                | Description                                                             |
|------------------|-------------------------|-------------------------------------------------------------------------|
| Application       | MQTT                    | Pub/sub communication between frontend, backend, and devices            |
| Session/Transport | WebSocket + TLS (443)   | Secure MQTT from browser to AWS IoT Core                               |
| Transport         | TLS over MQTT (8883)    | Secure MQTT from ESP32 to AWS IoT Core                                 |
| Identity          | HTTPS (REST)            | Cognito login, Identity Pool credential fetch                          |
| Security Tokens   | AWS SigV4, Cognito JWT  | Token-based authentication, AWS STS role assumption                    |


## 5. Testing & Results
- **All device control tested successfully** from multiple networks
- **Multiple users tested via Cognito registration**
- **Timer-based commands tested at multiple durations** (5s–10min)
- **Web interface reflects real-time state** from device publish events
- **Frontend correctly updates UI based on `/status` topic** even during rapid switching
- **WebSocket reconnection tested** for temporary disconnect scenarios

## 6. Improvements & Future Work
- Device binding to specific users
- Schedule-based automation (cron style)
- Feedback UI for failed actions
- Web push notifications for status
- Auto-reconnect for WebSocket failures
- Role-based topic permissions
- Policy separation per device or user

## 7. Conclusion
This project successfully delivers a complete end-to-end IoT light control system, integrating secure user authentication, cloud-based MQTT messaging, and embedded device actuation. It demonstrates how real-world smart home features can be implemented using ESP32 and AWS tools with modern web development techniques.

## 8. Reflection & Division of Work
- **Liyi Zhang**: Frontend development, AWS Cognito integration
- **Boyi Deng**: ESP32 firmware, MQTT TLS setup, IoT Core configuration
- **Zihui Jiang**: System architecture planning, documentation, and presentation design
- **Zuoyin Chen**: UI optimization, Vercel deployment, and testing

All members contributed to testing, debugging, and overall feature refinement. The system was developed in phases with coordinated GitHub collaboration and iterative testing.
