import React from 'react';
import SignalDashboard from './components/SignalDashboard';
import UserAuth from './components/UserAuth';

export default function App() {
  return (
    <>
      <SignalDashboard />
      <UserAuth onUserLoad={() => {}} />
    </>
  );
}
