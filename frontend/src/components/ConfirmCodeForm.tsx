// ConfirmCodeForm.tsx
import React, { useState } from 'react';
import { Form, Input, Button, Typography, message, Card } from 'antd';
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';
import { awsConfig } from '../aws/config';

const { Title } = Typography;

// Initialize Cognito User Pool
const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.userPoolId,
  ClientId: awsConfig.clientId
});

// Component props: email and callback to return to login
type Props = {
  email: string;
  onBackToLogin: () => void;
};

const ConfirmCodeForm: React.FC<Props> = ({ email, onBackToLogin }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  /**
   * Handle confirmation of the email verification code
   * @param code Verification code entered by the user
   */
  const handleConfirm = (code: string) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    setLoading(true);

    // Confirm user registration using the code
    user.confirmRegistration(code, true, (err) => {
      setLoading(false);
      if (err) {
        message.error(`Verification failed: ${err.message}`);
      } else {
        message.success('Email verified successfully. You can now log in.');
        onBackToLogin(); // Redirect back to login form
      }
    });
  };

  /**
   * Handle form submission
   */
  const onFinish = (values: any) => {
    handleConfirm(values.code);
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
          Verify Your Email
        </Title>

        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* Input field for the confirmation code */}
          <Form.Item
            name="code"
            label="Confirmation Code"
            rules={[{ required: true }]}
          >
            <Input
              size="large"
              placeholder="Enter the code sent to your email"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
            >
              Confirm
            </Button>

            <Button type="link" block onClick={onBackToLogin}>
              Back to Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ConfirmCodeForm;
