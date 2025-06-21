import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://chatroom1-6.onrender.com';

  const registerUser = async (e) => {
    e.preventDefault();

    if (!username || !password || !confirmPassword) {
      alert("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});


      const data = await res.json();
      if (res.ok) {
        alert("Registered successfully! Please login.");
        navigate('/');
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (err) {
      alert("Something went wrong. Try again.");
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-100 to-blue-100 overflow-hidden">
      <h1 className="absolute text-[9rem] text-teal-300 opacity-10 font-black tracking-wide select-none z-0">
        KSC
      </h1>

      <form
        onSubmit={registerUser}
        className="relative z-10 bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md border border-teal-200"
      >
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="KSC Logo" className="w-16 h-16 rounded-full shadow-sm" />
        </div>

        <h2 className="text-3xl font-extrabold text-center text-teal-700 mb-6">
          Create Account
        </h2>

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
          className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="w-full mb-4 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter Password"
          required
          className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
        />

        <button
          type="submit"
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg transition"
        >
          Register
        </button>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <span
            onClick={() => navigate('/')}
            className="text-teal-500 hover:underline cursor-pointer font-medium"
          >
            Login here
          </span>
        </p>
      </form>
    </div>
  );
}

export default Register;
