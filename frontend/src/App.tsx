// App.tsx
import { useState } from 'react';
import { Layout, Button, Card, Menu } from 'antd';
import AWS from 'aws-sdk';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ConfirmCodeForm from './components/ConfirmCodeForm';
import ControlPanel from './components/ControlPanel';

const { Header, Content } = Layout;

// Define the list of available devices (with the same topic for demo purposes)
const devices = [
  { name: 'Living Room Light', topic: 'esp32/light' },
  { name: 'Bedroom Light', topic: 'esp32/light' },
  { name: 'Garage Light', topic: 'esp32/light' }
];

function App() {
  // Store AWS Cognito credentials after login
  const [creds, setCreds] = useState<AWS.CognitoIdentityCredentials | null>(null);

  // Currently selected device from the device menu
  const [selectedDevice, setSelectedDevice] = useState(devices[0]);

  // Current UI page: 'login' | 'register' | 'verify'
  const [page, setPage] = useState<'login' | 'register' | 'verify'>('login');

  // Temporarily store email for verification after registration
  const [pendingEmail, setPendingEmail] = useState<string>('');

  return (
    <Layout
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}
    >
      {/* Application Header */}
      <Header
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 600,
          height: 64,
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}
      >
        <div>ESP32 Light Control System</div>

        {/* Logout button if credentials exist */}
        {creds && (
          <Button
            type="text"
            style={{ color: 'white', fontWeight: 500 }}
            onClick={() => setCreds(null)}
          >
            Logout
          </Button>
        )}
      </Header>

      {/* Main content area */}
      <Content style={{ display: 'flex', padding: '24px', gap: '24px' }}>
        {creds ? (
          <>
            {/* Sidebar with device menu */}
            <Card title="Device List" style={{ width: 260 }}>
              <Menu
                mode="vertical"
                selectedKeys={[selectedDevice.name]}
                onClick={({ key }) => {
                  const dev = devices.find(d => d.name === key);
                  if (dev) setSelectedDevice(dev);
                }}
                items={devices.map(d => ({ key: d.name, label: d.name }))}
              />
            </Card>

            {/* Main panel for controlling the selected device */}
            <div style={{ flex: 1 }}>
              <ControlPanel credentials={creds} device={selectedDevice} />
            </div>
          </>
        ) : (
          // If user is not logged in, show one of the auth forms
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <div style={{ width: '100%', maxWidth: 480 }}>
              {page === 'login' ? (
                <LoginForm
                  onLoginSuccess={setCreds}
                  onSwitchToRegister={() => setPage('register')}
                />
              ) : page === 'register' ? (
                <RegisterForm
                  onSwitchToLogin={() => setPage('login')}
                  onRegisterSuccess={(email) => {
                    setPendingEmail(email);
                    setPage('verify');
                  }}
                />
              ) : (
                <ConfirmCodeForm
                  email={pendingEmail}
                  onBackToLogin={() => setPage('login')}
                />
              )}
            </div>
          </div>
        )}
      </Content>
    </Layout>
  );
}

export default App;
