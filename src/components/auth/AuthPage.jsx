import React, { useState } from "react";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

export default function AuthPage({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  return isRegisterMode ? (
    <RegisterPage
      onRegisterSuccess={() => setIsRegisterMode(false)}
      onGoLogin={() => setIsRegisterMode(false)}
    />
  ) : (
    <LoginPage
      onLoginSuccess={onLoginSuccess}
      onGoRegister={() => setIsRegisterMode(true)}
    />
  );
}
