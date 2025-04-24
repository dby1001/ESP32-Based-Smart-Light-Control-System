// LoginForm.tsx
import React, { useState } from 'react';
import { Form, Input, Button, message, Typography, Card } from 'antd';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool
} from 'amazon-cognito-identity-js';
import AWS from 'aws-sdk';
import { awsConfig } from '../aws/config';

const { Title } = Typography;

// Initialize Cognito User Pool
const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.userPoolId,
  ClientId: awsConfig.clientId
});

type Props = {
  // Callback after successful login
  onLoginSuccess: (creds: AWS.CognitoIdentityCredentials) => void;
  // Switch to registration form
  onSwitchToRegister: () => void;
};

// Login form component
const LoginForm: React.FC<Props> = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  /**
   * Handles the Cognito login and AWS credential retrieval
   */
  const handleLogin = (email: string, password: string) => {
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

    setLoading(true);

    // Authenticate user using CognitoUser
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: session => {
        const idToken = session.getIdToken().getJwtToken();

        // Set AWS credentials using Cognito Identity Pool
        AWS.config.region = awsConfig.region;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
          IdentityPoolId: awsConfig.identityPoolId,
          Logins: {
            [`cognito-idp.${awsConfig.region}.amazonaws.com/${awsConfig.userPoolId}`]: idToken
          }
        });

        const creds = AWS.config.credentials as AWS.CognitoIdentityCredentials;

        // Fetch AWS credentials (accessKeyId, secretAccessKey, sessionToken)
        creds.get(async err => {
          setLoading(false);

          if (err) {
            message.error('Failed to retrieve AWS credentials');
          } else {
            message.success('Login successful');

            /**
             * Call backend to attach IoT policy to current identity
             * This requires IAM credentials and is done on the server side
             */
            try {
              const response = await fetch('https://iot-authenticator.onrender.com/attach-policy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identityId: creds.identityId })
              });

              const result = await response.json();
              if (!response.ok) {
                console.warn('IoT policy attach failed:', result.error);
              } else {
                console.log('IoT policy attached successfully');
              }
            } catch (e) {
              console.error('Error calling backend to attach policy:', e);
            }

            // Continue to application
            onLoginSuccess(creds);
          }
        });
      },
      onFailure: err => {
        setLoading(false);
        message.error(`Login failed: ${err.message}`);
      }
    });
  };

  // Called when form is submitted
  const onFinish = (values: any) => {
    const { email, password } = values;
    handleLogin(email, password);
  };

  // UI
  return (
    <div style={{
      minHeight: '90vh',
      maxHeight: '90vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      borderRadius: '1rem'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 480,
          padding: '2rem',
          borderRadius: '1rem'
        }}
      >
        <Title level={3} style={{ textAlign: 'center' }}>
          ESP32 Light Control Login
        </Title>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" size="large" htmlType="submit" loading={loading} block>
              Login
            </Button>
            <Button type="link" block onClick={onSwitchToRegister}>
              Don't have an account? Register here
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginForm;
