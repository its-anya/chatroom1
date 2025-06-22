import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const loginUser = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      alert('Please enter username and password');
      return;
    }

    try {
      const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://chatroom1-6.onrender.com';
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        // Store user data in local storage
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        localStorage.setItem('role', data.role);

        // ✅ Redirect everyone to chatroom first
        navigate('/chatroom');
      } else {
        alert(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error(err);
      alert('Server error. Please try again later.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-purple-100 to-blue-100 overflow-hidden">
      {/* Background text */}
      <h1 className="absolute text-[10rem] text-purple-300 opacity-10 font-extrabold tracking-wide select-none z-0">
        KSC Chatroom
      </h1>

      {/* Login Form */}
      <form
        onSubmit={loginUser}
        className="relative z-10 bg-white shadow-2xl rounded-xl px-10 py-8 w-full max-w-md border border-purple-200"
      >
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="KSC Logo" className="w-20 h-20 rounded-full shadow-md" />
        </div>

        <h2 className="text-3xl font-extrabold mb-6 text-center text-purple-700">
          Login to Chat
        </h2>

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full px-4 py-3 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 mb-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        <button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-md transition"
        >
          Login
        </button>

        <p className="text-sm mt-4 text-center text-gray-600">
          Don&apos;t have an account?{' '}
          <span
            className="text-blue-600 hover:underline cursor-pointer font-medium"
            onClick={() => navigate('/register')}
          >
            Register here
          </span>
        </p>
      </form>
    </div>
  );
}

export default Login;
