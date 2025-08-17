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

  // --- Video call additions ---
  const [showCallOptions, setShowCallOptions] = useState(false);
  const [callType, setCallType] = useState('audio'); // 'audio' or 'video'
  const peerRef = useRef();
  const localAudioRef = useRef();
  const remoteAudioRef = useRef();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCallPeer, setCurrentCallPeer] = useState(null);

  // Load messages
  const handleLoadMessages = useCallback((messages) => {
    setChat(messages);
  }, []);

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
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    if (currentCallPeer) {
      socketRef.current.emit('end-call', { targetId: currentCallPeer });
    }
    setCurrentCallPeer(null);
  }, [currentCallPeer]);

  // --- AUDIO CALL ---
  const startCall = async (targetUsername) => {
    try {
      setInCall(true);
      setCurrentCallPeer(targetUsername);
      setCallType('audio');
      peerRef.current = new window.RTCPeerConnection();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localAudioRef.current.srcObject = stream;
      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit('ice-candidate', { targetId: targetUsername, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
      };

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      socketRef.current.emit('call-user', { targetId: targetUsername, offer, caller: username, isVideo: false });
    } catch (err) {
      alert('Could not start call: ' + err.message);
      setInCall(false);
      setCurrentCallPeer(null);
    }
  };

  // --- VIDEO CALL ---
  const startVideoCall = async (targetUsername) => {
    try {
      setInCall(true);
      setCurrentCallPeer(targetUsername);
      setCallType('video');
      peerRef.current = new window.RTCPeerConnection();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localAudioRef.current.srcObject = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit('ice-candidate', { targetId: targetUsername, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      socketRef.current.emit('call-user', { targetId: targetUsername, offer, caller: username, isVideo: true });
    } catch (err) {
      alert('Could not start video call: ' + err.message);
      setInCall(false);
      setCurrentCallPeer(null);
    }
  };

  // Show popup on incoming call
  const handleIncomingCall = useCallback(({ from, offer, caller, isVideo }) => {
    setIncomingCall({ from, offer, caller, isVideo });
  }, []);

  // Accept call from popup
  const acceptCall = async () => {
    if (!incomingCall) return;
    setInCall(true);
    setCurrentCallPeer(incomingCall.from);
    setCallType(incomingCall.isVideo ? 'video' : 'audio');
    setIncomingCall(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.isVideo ? true : false
      });
      localAudioRef.current.srcObject = stream;
      if (incomingCall.isVideo && localVideoRef.current) localVideoRef.current.srcObject = stream;
      peerRef.current = new window.RTCPeerConnection();

      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit('ice-candidate', { targetId: incomingCall.from, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
        if (incomingCall.isVideo && remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };

      await peerRef.current.setRemoteDescription(new window.RTCSessionDescription(incomingCall.offer));
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
      await peerRef.current.setRemoteDescription(new window.RTCSessionDescription(answer));
      try {
        if (!localAudioRef.current.srcObject) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video'
          });
          localAudioRef.current.srcObject = stream;
          if (callType === 'video' && localVideoRef.current) localVideoRef.current.srcObject = stream;
          stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
        }
      } catch (err) {
        alert('Could not open microphone: ' + err.message);
        endCall();
      }
    }
  };

  const handleICECandidate = async ({ candidate }) => {
    try {
      if (peerRef.current) {
        await peerRef.current.addIceCandidate(new window.RTCIceCandidate(candidate));
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
      alert('The other user ended the call.');
    });
    return () => {
      if (socketRef.current) socketRef.current.off('end-call');
    };
  }, [endCall]);

  // Listen for real-time online users (ALWAYS use latest username from state)
  useEffect(() => {
    if (!socketRef.current) return;
    const handleOnlineUsers = (users) => {
      const uname = (username || '').trim().toLowerCase();
      const filtered = users.filter(u => (u || '').trim().toLowerCase() !== uname);
      setConnectedUsers(filtered);
    };
    socketRef.current.on('online-users', handleOnlineUsers);
    return () => {
      if (socketRef.current) socketRef.current.off('online-users', handleOnlineUsers);
    };
  }, [username]);

  // Socket connection and listeners
  useEffect(() => {
    const token = localStorage.getItem('token');
    const uname = (localStorage.getItem('username') || '').trim();
    const userRole = localStorage.getItem('role');

    // If username is not set, redirect to login
    if (!token || !uname) {
      navigate('/');
      return;
    }

    setUsername(uname);
    setRole(userRole);

    socketRef.current = io('https://chatroom1-6.onrender.com', { autoConnect: false });
    socketRef.current.connect();

    socketRef.current.on('connect', () => {
      socketRef.current.emit('register-user', uname);
    });

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
    if (!socketRef.current.connected) return;
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
    <div className="min-h-screen bg-gradient-to-br from-[#00ffff] via-[#ff00ff] to-[#00ffff] p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-bold text-[#ff00ff] flex items-center gap-2">
          <img src="/logo.png" alt="logo" className="w-8 h-8 drop-shadow-[0_0_5px_#ff00ff]" /> KSC Chat
        </h2>
        <div className="flex gap-2">
          {role === 'admin' && (
            <button onClick={() => navigate('/admin-dashboard')} className="bg-[#ff00ff] text-black px-4 py-2 rounded-md hover:bg-[#cc00cc] drop-shadow-[0_0_5px_#ff00ff]">
              Admin
            </button>
          )}
          <button onClick={() => { setShowCallOptions(true); setCallType('audio'); }} className="bg-[#00ffff] text-black px-4 py-2 rounded-md hover:bg-[#00cccc] drop-shadow-[0_0_5px_#00ffff]">📞 Call</button>
          <button onClick={() => { setShowCallOptions(true); setCallType('video'); }} className="bg-[#ff00ff] text-black px-4 py-2 rounded-md hover:bg-[#cc00cc] drop-shadow-[0_0_5px_#ff00ff]">🎥 Video Call</button>
          <button onClick={handleLogout} className="bg-[#ff0000] text-black px-4 py-2 rounded-md hover:bg-[#cc0000] drop-shadow-[0_0_5px_#ff0000]">Logout</button>
        </div>
      </div>

      {showCallOptions && (
        <div className="bg-black bg-opacity-80 p-4 rounded shadow-md mb-4 border border-[#00ffff] drop-shadow-[0_0_10px_#00ffff]">
          <h3 className="text-lg font-bold mb-2 text-[#00ffff]">
            Start Personal {callType === 'video' ? 'Video' : 'Audio'} Call
          </h3>
          {connectedUsers.length === 0 && (
            <div className="text-[#00ffff]">No users online to call.</div>
          )}
          {connectedUsers.map((user, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (callType === 'video') {
                  startVideoCall(user);
                } else {
                  startCall(user);
                }
                setShowCallOptions(false);
              }}
              className="block text-left w-full py-1 hover:bg-[#ff00ff] hover:text-black transition-colors"
            >
              {callType === 'video' ? '🎥 Video Call' : '📞 Call'} {user}
            </button>
          ))}
        </div>
      )}

      <div className="bg-black bg-opacity-80 rounded-lg shadow-md p-4 h-[500px] overflow-y-auto mb-4 border border-[#00ffff] drop-shadow-[0_0_10px_#00ffff]">
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
              <div className={`relative p-3 max-w-xs rounded-lg shadow-md ${isMe ? 'bg-[#ff00ff] text-black text-right' : 'bg-[#00ffff] text-black'}`}>
                <div className="text-sm font-semibold">{msg.sender}</div>
                {msg.type === 'file' && fileData ? (
                  fileData.type.startsWith('image/') ? (
                    <img src={fileData.data} alt="shared" className="mt-2 rounded-md" />
                  ) : fileData.type.startsWith('video/') ? (
                    <video controls className="mt-2 rounded-md">
                      <source src={fileData.data} type={fileData.type} />
                    </video>
                  ) : (
                    <a href={fileData.data} download={fileData.name} className="text-[#00ffff] underline mt-2 block">📄 {fileData.name}</a>
                  )
                ) : (
                  <div className="text-base">{msg.content}</div>
                )}
                <div className="text-xs mt-1 opacity-70">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
                {canDelete && msg._id && (
                  <button onClick={() => deleteMessage(msg._id)} className="absolute top-1 right-1 text-black opacity-70 hover:opacity-100" title="Delete message">
                    <FaTrashAlt />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef}></div>
      </div>

      {/* Mini video screens at the bottom during video call */}
      {inCall && callType === 'video' && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 16,
            zIndex: 1000,
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 12,
            padding: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#555' }}>You</span>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              width={160}
              height={120}
              style={{ borderRadius: 8, background: '#222' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#555' }}>Remote</span>
            <video
              ref={remoteVideoRef}
              autoPlay
              width={160}
              height={120}
              style={{ borderRadius: 8, background: '#222' }}
            />
          </div>
        </div>
      )}

      {/* Audio elements for call (keep for both audio and video calls) */}
      <div className="flex gap-4 justify-center mb-4">
        <audio ref={localAudioRef} autoPlay muted={false} hidden={!localAudioRef.current?.srcObject} />
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
