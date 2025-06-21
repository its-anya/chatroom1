import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Picker from 'emoji-picker-react';

const socket = io('https://chatroom1-6.onrender.com', { autoConnect: false });

function ChatRoom() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef(null);
  const socketListenerRef = useRef(false);

  const handleLoadMessages = useCallback((messages) => {
    setChat(messages);
  }, []);

  const handleIncomingMessage = useCallback((msg) => {
    setChat((prev) => [...prev, msg]);
  }, []);

  const handleFileUpload = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const messageData = {
        sender: username,
        content: JSON.stringify({
          name: file.name,
          type: file.type,
          data: reader.result,
        }),
        type: 'file',
      };

      socket.emit('chatFile', messageData);
    };

    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const uname = localStorage.getItem('username');
    const userRole = localStorage.getItem('role');

    if (!token) {
      navigate('/');
      return;
    }

    setUsername(uname);
    setRole(userRole);

    if (!socketListenerRef.current) {
      socket.on('loadMessages', handleLoadMessages);
      socket.on('chatMessage', handleIncomingMessage);
      socket.on('chatFile', handleIncomingMessage);
      socketListenerRef.current = true;
    }

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('loadMessages', handleLoadMessages);
      socket.off('chatMessage', handleIncomingMessage);
      socket.off('chatFile', handleIncomingMessage);
      socketListenerRef.current = false;
    };
  }, [handleIncomingMessage, handleLoadMessages, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() === '') return;

    const chatMessage = {
      sender: username,
      content: message,
      type: 'text',
    };

    socket.emit('chatMessage', chatMessage);
    setMessage('');
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // ✅ Updated for latest emoji-picker-react v4+
  const onEmojiClick = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-bold text-purple-700 flex items-center gap-2">
          <img src="/logo.png" alt="logo" className="w-8 h-8" /> KSC Chat
        </h2>
        <div className="flex gap-2">
          {role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Admin Panel
            </button>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 h-[500px] overflow-y-auto mb-4">
        {chat.map((msg, i) => {
          const isMe = msg.sender === username;
          let fileData = null;

          if (msg.type === 'file') {
            try {
              fileData = JSON.parse(msg.content);
            } catch (err) {
              console.error('Invalid file content:', err);
            }
          }

          return (
            <div
              key={msg._id || `${msg.sender}-${msg.timestamp}-${i}`}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
            >
              <div
                className={`p-3 max-w-xs rounded-lg shadow-md ${
                  isMe
                    ? 'bg-purple-500 text-white text-right'
                    : 'bg-blue-100 text-gray-800'
                }`}
              >
                <div className="text-sm font-semibold">{msg.sender}</div>
                {msg.type === 'file' && fileData ? (
                  fileData.type.startsWith('image/') ? (
                    <img src={fileData.data} alt="shared" className="mt-2 rounded-md" />
                  ) : fileData.type.startsWith('video/') ? (
                    <video controls className="mt-2 rounded-md">
                      <source src={fileData.data} type={fileData.type} />
                    </video>
                  ) : (
                    <a
                      href={fileData.data}
                      download={fileData.name}
                      className="text-blue-600 underline mt-2 block"
                    >
                      📄 {fileData.name}
                    </a>
                  )
                ) : (
                  <div className="text-base">{msg.content}</div>
                )}
                <div className="text-xs mt-1 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef}></div>
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2 relative">
        <label htmlFor="fileInput" className="cursor-pointer">
          <img src="/clip-icon.png" alt="Attach" className="w-6 h-6" />
          <input
            id="fileInput"
            type="file"
            className="hidden"
            accept=".pdf,image/*,video/*"
            onChange={(e) => handleFileUpload(e.target.files[0])}
          />
        </label>

        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="text-xl px-2 focus:outline-none"
        >
          😊
        </button>

        {showEmojiPicker && (
          <div className="absolute bottom-20 left-12 z-50">
            <Picker onEmojiClick={onEmojiClick} />
          </div>
        )}

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          type="submit"
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatRoom;
