import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Picker from 'emoji-picker-react';
import { FaTrashAlt } from 'react-icons/fa';
import CallPopup from '../components/CallPopup';

function ChatRoom() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);

  const [showCallOptions, setShowCallOptions] = useState(false);
  const peerRef = useRef();
  const localAudioRef = useRef();
  const remoteAudioRef = useRef();
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCallPeer, setCurrentCallPeer] = useState(null); // Track peer

  // Load messages and users
  const handleLoadMessages = useCallback((messages) => {
    setChat(messages);
    const users = [...new Set(messages.map(m => m.sender))];
    setConnectedUsers(users.filter(u => u !== username));
  }, [username]);

  // Handle incoming chat or file message
  const handleIncomingMessage = useCallback((msg) => {
    setChat((prev) => [...prev, msg]);
  }, []);

  // Handle deleted message
  const handleDeletedMessage = useCallback((messageId) => {
    setChat((prev) => prev.filter((msg) => msg._id !== messageId));
  }, []);

  // Handle file upload
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
      socketRef.current.emit('chatFile', messageData);
    };
    reader.readAsDataURL(file);
  };

  // End call logic
  const endCall = useCallback(() => {
    setInCall(false);
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localAudioRef.current && localAudioRef.current.srcObject) {
      localAudioRef.current.srcObject.getTracks().forEach(track => track.stop());
      localAudioRef.current.srcObject = null;
    }
    if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.srcObject.getTracks().forEach(track => track.stop());
      remoteAudioRef.current.srcObject = null;
    }
    // Only emit if we know the peer
    if (currentCallPeer) {
      socketRef.current.emit('end-call', { targetId: currentCallPeer });
    }
    setCurrentCallPeer(null);
  }, [currentCallPeer]);

  // WebRTC Call Handlers
  // Only send offer, don't open audio until accepted
  const startCall = async (targetUsername) => {
    try {
      setInCall(true);
      setCurrentCallPeer(targetUsername);
      peerRef.current = new window.RTCPeerConnection();

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit('ice-candidate', { targetId: targetUsername, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        remoteAudioRef.current.srcObject = e.streams[0];
      };

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      socketRef.current.emit('call-user', { targetId: targetUsername, offer, caller: username });
    } catch (err) {
      alert('Could not start call: ' + err.message);
      setInCall(false);
      setCurrentCallPeer(null);
    }
  };

  // Show popup on incoming call
  const handleIncomingCall = useCallback(({ from, offer, caller }) => {
    setIncomingCall({ from, offer, caller });
  }, []);

  // Accept call from popup
  const acceptCall = async () => {
    if (!incomingCall) return;
    setInCall(true);
    setCurrentCallPeer(incomingCall.from);
    setIncomingCall(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // audio only
      localAudioRef.current.srcObject = stream;
      peerRef.current = new window.RTCPeerConnection();

      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit('ice-candidate', { targetId: incomingCall.from, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        remoteAudioRef.current.srcObject = e.streams[0];
      };

      await peerRef.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socketRef.current.emit('answer-call', { targetId: incomingCall.from, answer });
    } catch (err) {
      alert('Could not answer call: ' + err.message);
      setInCall(false);
      setCurrentCallPeer(null);
    }
  };

  // Reject call from popup
  const rejectCall = () => {
    if (incomingCall) {
      socketRef.current.emit('reject-call', { targetId: incomingCall.from });
      setIncomingCall(null);
    }
  };

  // Listen for call rejection on caller side
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on('call-rejected', () => {
      endCall();
      alert('Call was rejected.');
    });
    return () => {
      if (socketRef.current) socketRef.current.off('call-rejected');
    };
  }, [endCall]);

  // When call is answered, open local audio and add tracks
  const handleCallAnswered = async ({ answer }) => {
    if (peerRef.current) {
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // audio only
        localAudioRef.current.srcObject = stream;
        stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
      } catch (err) {
        alert('Could not open microphone: ' + err.message);
        endCall();
      }
    }
  };

  const handleICECandidate = async ({ candidate }) => {
    try {
      if (peerRef.current) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.error('ICE Error:', e);
    }
  };

  // Listen for end-call event
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on('end-call', () => {
      endCall();
    });
    return () => {
      if (socketRef.current) socketRef.current.off('end-call');
    };
  }, [endCall]);

  // Socket connection and listeners
  useEffect(() => {
    const token = localStorage.getItem('token');
    const uname = localStorage.getItem('username');
    const userRole = localStorage.getItem('role');

    if (!token) return navigate('/');

    setUsername(uname);
    setRole(userRole);

    const socket = io('https://chatroom1-6.onrender.com', { autoConnect: false });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('register-user', uname);
    });
    socketRef.current.on('disconnect', () => {});

    socketRef.current.on('loadMessages', handleLoadMessages);
    socketRef.current.on('chatMessage', handleIncomingMessage);
    socketRef.current.on('chatFile', handleIncomingMessage);
    socketRef.current.on('deleteMessage', handleDeletedMessage);
    socketRef.current.on('incoming-call', handleIncomingCall);
    socketRef.current.on('call-answered', handleCallAnswered);
    socketRef.current.on('ice-candidate', handleICECandidate);

    return () => {
      socketRef.current.disconnect();
    };
    // eslint-disable-next-line
  }, [handleIncomingMessage, handleLoadMessages, handleDeletedMessage, navigate, handleIncomingCall]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Send chat message
  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (!socketRef.current.connected) {
      return;
    }

    const chatMessage = { sender: username, content: message.trim(), type: 'text' };
    socketRef.current.emit('chatMessage', chatMessage);
    setMessage('');
  };

  // Delete message
  const deleteMessage = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      socketRef.current.emit('deleteMessage', messageId);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // Emoji picker
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
            <button onClick={() => navigate('/admin')} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
              Admin Panel
            </button>
          )}
          <button onClick={() => setShowCallOptions(true)} className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">📞 Call</button>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">Logout</button>
        </div>
      </div>

      {showCallOptions && (
        <div className="bg-white p-4 rounded shadow-md mb-4">
          <h3 className="text-lg font-bold mb-2">Start Personal Call</h3>
          {connectedUsers.map((user, idx) => (
            <button key={idx} onClick={() => { startCall(user); setShowCallOptions(false); }} className="block text-left w-full py-1 hover:bg-purple-100">
              📞 Call {user}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-4 h-[500px] overflow-y-auto mb-4">
        {chat.map((msg, i) => {
          const isMe = msg.sender === username;
          const isAdmin = role === 'admin';
          const canDelete = isMe || isAdmin;
          let fileData = null;

          if (msg.type === 'file') {
            try {
              fileData = JSON.parse(msg.content);
            } catch {}
          }

          return (
            <div key={msg._id || `${msg.sender}-${msg.timestamp}-${i}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
              <div className={`relative p-3 max-w-xs rounded-lg shadow-md ${isMe ? 'bg-purple-500 text-white text-right' : 'bg-blue-100 text-gray-800'}`}>
                <div className="text-sm font-semibold">{msg.sender}</div>
                {msg.type === 'file' && fileData ? (
                  fileData.type.startsWith('image/') ? (
                    <img src={fileData.data} alt="shared" className="mt-2 rounded-md" />
                  ) : fileData.type.startsWith('video/') ? (
                    <video controls className="mt-2 rounded-md">
                      <source src={fileData.data} type={fileData.type} />
                    </video>
                  ) : (
                    <a href={fileData.data} download={fileData.name} className="text-blue-600 underline mt-2 block">📄 {fileData.name}</a>
                  )
                ) : (
                  <div className="text-base">{msg.content}</div>
                )}
                <div className="text-xs mt-1 opacity-70">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
                {canDelete && msg._id && (
                  <button onClick={() => deleteMessage(msg._id)} className="absolute top-1 right-1 text-white opacity-70 hover:opacity-100" title="Delete message">
                    <FaTrashAlt />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef}></div>
      </div>

      <div className="flex gap-4 justify-center mb-4">
        {/* Audio elements for call */}
        <audio ref={localAudioRef} autoPlay muted hidden={!localAudioRef.current?.srcObject} />
        <audio ref={remoteAudioRef} autoPlay hidden={!remoteAudioRef.current?.srcObject} />
      </div>

      {inCall && (
        <button
          onClick={endCall}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 mb-4"
        >
          End Call
        </button>
      )}

      {incomingCall && (
        <CallPopup
          caller={incomingCall.caller}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      <form onSubmit={sendMessage} className="flex items-center gap-2 relative">
        <label htmlFor="fileInput" className="cursor-pointer">
          <img src="/clip-icon.png" alt="Attach" className="w-6 h-6" />
          <input id="fileInput" type="file" className="hidden" accept=".pdf,image/*,video/*" onChange={(e) => handleFileUpload(e.target.files[0])} />
        </label>
        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-xl px-2 focus:outline-none">😊</button>
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-12 z-50">
            <Picker onEmojiClick={onEmojiClick} />
          </div>
        )}
        <input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400" />
        <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">Send</button>
      </form>
    </div>
  );
}

export default ChatRoom;
