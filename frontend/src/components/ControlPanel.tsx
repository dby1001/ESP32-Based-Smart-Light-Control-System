import React, { useEffect, useState } from 'react';
import mqtt from 'mqtt';
import {
  Button,
  InputNumber,
  Select,
  Space,
  Typography,
  message,
  Card
} from 'antd';
import { connectMqttClient, getSignedUrl } from '../aws/mqttConnect';
import AWS from 'aws-sdk';

const { Title, Text } = Typography;

// Props from parent component: AWS credentials and the selected device
interface Props {
  credentials: AWS.CognitoIdentityCredentials;
  device: {
    name: string;
    topic: string;
  };
}

// Main control panel for the selected IoT device
const ControlPanel: React.FC<Props> = ({ credentials, device }) => {
  const [client, setClient] = useState<mqtt.MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lightStatus, setLightStatus] = useState<string>('Unknown');
  const [timerValue, setTimerValue] = useState<number>(5);
  const [timerUnit, setTimerUnit] = useState<'s' | 'm' | 'h'>('s');
  const [timerAction, setTimerAction] = useState<'on' | 'off'>('off');

  /**
   * MQTT Client initialization
   * Runs once on component mount or credentials change
   */
  useEffect(() => {
    const signedUrl = getSignedUrl(credentials); // Generate signed WebSocket URL
    const mqttClient = connectMqttClient(signedUrl); // Connect to AWS IoT over WebSocket

    mqttClient.on('connect', () => {
      setIsConnected(true);
      message.success('Connected to AWS IoT');
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT error:', err);
      message.error('MQTT connection failed');
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end(true); // Clean disconnect on unmount
    };
  }, [credentials]);

  /**
   * Subscribes to device status topic
   * Re-subscribes when device or client changes
   */
  useEffect(() => {
    if (!client) return;

    const topic = `${device.topic}/status`;

    // Handle incoming messages for device status
    const handleMessage = (t: string, payload: Buffer) => {
      if (t === topic) {
        setLightStatus(payload.toString());
      }
    };

    client.subscribe(topic);
    client.on('message', handleMessage);

    // Cleanup: unsubscribe and remove listener
    return () => {
      client.unsubscribe(topic);
      client.off('message', handleMessage);
    };
  }, [client, device]);

  /**
   * Send on/off command to the device
   */
  const send = (msg: string) => {
    if (!client || client.disconnecting || !client.connected) {
      message.warning('MQTT is not connected');
      return;
    }
    client.publish(`${device.topic}/control`, msg);
    message.success(`Sent: ${msg}`);
  };

  /**
   * Send delay timer command to the device
   */
  const sendTimer = () => {
    if (!client || client.disconnecting || !client.connected) {
      message.warning('MQTT is not connected');
      return;
    }

    const unitMap = { s: 1000, m: 60000, h: 3600000 };
    const durationMs = timerValue * unitMap[timerUnit];

    const payload = JSON.stringify({
      command: 'delay',
      action: timerAction,
      duration: durationMs
    });

    client.publish(`${device.topic}/control`, payload);
    message.success(`Timer set: ${timerValue} ${timerUnit} to ${timerAction}`);
  };

  /**
   * Render UI with control buttons and timer options
   */
  return (
    <div style={{ padding: '1rem' }}>
      <Card
        style={{
          borderRadius: '1rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          padding: '2rem'
        }}
      >
        <Title level={3}>{device.name}</Title>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Text>Device Status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
          <Text>Light Status: {lightStatus}</Text>

          <Space>
            <Button type="primary" size="large" onClick={() => send('on')}>
              Turn On
            </Button>
            <Button danger size="large" onClick={() => send('off')}>
              Turn Off
            </Button>
          </Space>

          <Space size="large" wrap>
            <Select
              value={timerAction}
              onChange={(v) => setTimerAction(v)}
              options={[
                { label: 'Turn Off after timer', value: 'off' },
                { label: 'Turn On after timer', value: 'on' }
              ]}
              style={{ width: 200 }}
              size="large"
            />
            <InputNumber
              min={1}
              max={999}
              value={timerValue}
              onChange={(v) => setTimerValue(v || 1)}
              size="large"
            />
            <Select
              value={timerUnit}
              onChange={(v) => setTimerUnit(v)}
              options={[
                { label: 'seconds', value: 's' },
                { label: 'minutes', value: 'm' },
                { label: 'hours', value: 'h' }
              ]}
              size="large"
              style={{ width: 120 }}
            />
            <Button type="default" size="large" onClick={sendTimer}>
              Set Timer
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default ControlPanel;
