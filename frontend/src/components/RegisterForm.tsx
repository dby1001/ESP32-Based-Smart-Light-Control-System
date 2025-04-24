// RegisterForm.tsx
import React, { useState } from 'react';
import { Form, Input, Button, message, Typography, Card } from 'antd';
import { CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';
import { awsConfig } from '../aws/config';

const { Title } = Typography;

// Create an instance of CognitoUserPool with the project configuration
const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.userPoolId,
  ClientId: awsConfig.clientId
});

type Props = {
  // Callback to switch back to login form
  onSwitchToLogin: () => void;
  // Callback triggered on successful registration
  onRegisterSuccess: (email: string) => void;
};

// Component for user registration
const RegisterForm: React.FC<Props> = ({ onSwitchToLogin, onRegisterSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  /**
   * Registers a new user in the Cognito User Pool
   * @param email - Email to be used as username
   * @param password - Chosen password
   */
  const handleRegister = (email: string, password: string) => {
    // Attach email as user attribute
    const attrList = [new CognitoUserAttribute({ Name: 'email', Value: email })];

    // Sign up user using the Cognito SDK
    userPool.signUp(email, password, attrList, [], (err) => {
      setLoading(false);
      if (err) {
        message.error(`Registration failed: ${err.message}`);
      } else {
        // Trigger callback for confirmation code verification
        message.success('Registered successfully. Please check your email for the confirmation code.');
        onRegisterSuccess(email);
      }
    });
  };

  /**
   * Called when the form is submitted
   */
  const onFinish = (values: any) => {
    const { email, password } = values;
    setLoading(true);
    handleRegister(email, password);
  };

  return (
    <div
      style={{
        minHeight: '90vh',
        maxHeight: '90vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        borderRadius: '1rem'
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 480,
          padding: '2rem',
          borderRadius: '1rem'
        }}
      >
        <Title level={3} style={{ textAlign: 'center' }}>
          Create an Account
        </Title>
        <Form autoComplete='off' form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={loading}
              block
            >
              Register
            </Button>
            <Button type="link" block onClick={onSwitchToLogin}>
              Already have an account? Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterForm;
