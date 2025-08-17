import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Picker from 'emoji-picker-react';
import { 
  FaTrashAlt, FaPhone, FaVideo, FaSignOutAlt, FaPaperclip, 
  FaSmile, FaPaperPlane, FaPhoneSlash, FaUsers, FaCrown,
  FaCircle, FaMicrophone, FaMicrophoneSlash, FaVideoSlash,
  FaExpand, FaCompress, FaVolumeUp, FaVolumeMute, FaHeart,
  FaThumbsUp, FaLaugh, FaSadTear, FaAngry, FaSurprise
} from 'react-icons/fa';
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
  const typingTimeoutRef = useRef(null);

  // Enhanced user tracking
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userLastSeen, setUserLastSeen] = useState({});

  // Interactive features
  const [showUserList, setShowUserList] = useState(false);
  const [messageReactions, setMessageReactions] = useState({});
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // Video call additions
  const [showCallOptions, setShowCallOptions] = useState(false);
  const [callType, setCallType] = useState('audio');
  const peerRef = useRef();
  const localAudioRef = useRef();
  const remoteAudioRef = useRef();
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pendingCandidatesRef = useRef([]);
  const remoteStreamRef = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCallPeer, setCurrentCallPeer] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Window focus tracking for unread messages
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      setUnreadCount(0);
    };
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Typing indicator
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      socketRef.current?.emit('typing-start', { username });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current?.emit('typing-stop', { username });
    }, 1000);
  }, [isTyping, username]);

  // Enhanced message handlers
  const handleLoadMessages = useCallback((messages) => {
    setChat(messages);
  }, []);

  const handleIncomingMessage = useCallback((msg) => {
    setChat((prev) => [...prev, msg]);
    
    // Update unread count if window is not focused
    if (!isWindowFocused && msg.sender !== username) {
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification
      if (Notification.permission === 'granted') {
        new Notification(`New message from ${msg.sender}`, {
          body: msg.type === 'file' ? 'Sent a file' : msg.content,
          icon: '/logo.png'
        });
      }
    }
  }, [isWindowFocused, username]);

  const handleDeletedMessage = useCallback((messageId) => {
    setChat((prev) => prev.filter((msg) => msg._id !== messageId));
  }, []);

  // Enhanced user tracking handlers
  const handleUserJoined = useCallback((data) => {
    setChat((prev) => [...prev, {
      _id: Date.now(),
      type: 'system',
      content: `${data.username} joined the chat`,
      timestamp: new Date().toISOString(),
      sender: 'System'
    }]);
  }, []);

  const handleUserLeft = useCallback((data) => {
    setChat((prev) => [...prev, {
      _id: Date.now(),
      type: 'system',
      content: `${data.username} left the chat`,
      timestamp: new Date().toISOString(),
      sender: 'System'
    }]);
    
    // Update last seen
    setUserLastSeen(prev => ({
      ...prev,
      [data.username]: new Date().toISOString()
    }));
  }, []);

  const handleOnlineUsers = useCallback((users) => {
    const currentUser = username?.trim().toLowerCase();
    const filteredUsers = users.filter(user => 
      user?.trim().toLowerCase() !== currentUser
    );
    setConnectedUsers(filteredUsers);
    
    // Update user statuses
    const newStatuses = {};
    filteredUsers.forEach(user => {
      newStatuses[user] = 'online';
    });
    setUserStatuses(newStatuses);
  }, [username]);

  const handleTypingStart = useCallback((data) => {
    if (data.username !== username) {
      setTypingUsers(prev => [...prev.filter(u => u !== data.username), data.username]);
    }
  }, [username]);

  const handleTypingStop = useCallback((data) => {
    setTypingUsers(prev => prev.filter(u => u !== data.username));
  }, []);

  // Reaction handlers
  const handleReaction = useCallback((data) => {
    setMessageReactions(prev => ({
      ...prev,
      [data.messageId]: {
        ...prev[data.messageId],
        [data.reaction]: [
          ...(prev[data.messageId]?.[data.reaction] || []),
          data.username
        ]
      }
    }));
  }, []);

  const addReaction = (messageId, reaction) => {
    socketRef.current?.emit('add-reaction', {
      messageId,
      reaction,
      username
    });
    setShowReactionPicker(null);
  };

  // File upload with progress
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
          size: file.size
        }),
        type: 'file',
      };
      socketRef.current.emit('chatFile', messageData);
    };
    reader.readAsDataURL(file);
  };

  // Enhanced call controls
  const toggleMute = () => {
    if (localAudioRef.current?.srcObject) {
      const audioTracks = localAudioRef.current.srcObject.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const videoTracks = localVideoRef.current.srcObject.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // End call logic
  const endCall = useCallback(() => {
    setInCall(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsFullscreen(false);
    
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    
    [localAudioRef, remoteAudioRef, localVideoRef, remoteVideoRef].forEach(ref => {
      const el = ref.current;
      if (!el) return;
      try { if (typeof el.pause === 'function') el.pause(); } catch (_) {}
      const src = el.srcObject;
      if (src) {
        try { src.getTracks().forEach(track => track.stop()); } catch (_) {}
        el.srcObject = null;
      }
    });
    
    if (currentCallPeer) {
      socketRef.current.emit('end-call', { targetId: currentCallPeer });
    }
    setCurrentCallPeer(null);
    pendingCandidatesRef.current = [];
    remoteStreamRef.current = null;
  }, [currentCallPeer]);

  // Helper function to safely close existing peer connection
  const closeExistingConnection = () => {
    if (peerRef.current) {
      try {
        peerRef.current.close();
        peerRef.current = null;
      } catch (error) {
        console.warn('Error closing existing connection:', error);
      }
    }
  };

  // Helper function to safely set remote description with state checking
  const safeSetRemoteDescription = async (description) => {
    if (!peerRef.current) {
      throw new Error('Peer connection not available');
    }

    const currentState = peerRef.current.signalingState;
    console.log('Current signaling state:', currentState);
    
    // Check if we're in the correct state for this operation
    if (description.type === 'answer' && currentState !== 'have-remote-offer') {
      console.warn(`Cannot set remote answer in state: ${currentState}`);
      return false;
    }
    
    if (description.type === 'offer' && currentState !== 'stable') {
      console.warn(`Cannot set remote offer in state: ${currentState}`);
      return false;
    }

    try {
      await peerRef.current.setRemoteDescription(description);
      console.log(`Successfully set remote ${description.type}`);
      return true;
    } catch (error) {
      console.error(`Error setting remote ${description.type}:`, error);
      throw error;
    }
  };

  // Audio call
  const startCall = async (targetUsername) => {
    try {
      // Close any existing connection first
      closeExistingConnection();
      
      setInCall(true);
      setCurrentCallPeer(targetUsername);
      setCallType('audio');
      
      peerRef.current = new window.RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localAudioRef.current.srcObject = stream;
      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate && targetUsername) {
          socketRef.current.emit('ice-candidate', { targetId: targetUsername, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
          if (remoteAudioRef.current.play) { remoteAudioRef.current.play().catch(() => {}); }
        }
      };

      peerRef.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerRef.current.connectionState);
        if (peerRef.current.connectionState === 'failed' || 
            peerRef.current.connectionState === 'disconnected') {
          endCall();
        }
      };

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      socketRef.current.emit('call-user', { 
        targetId: targetUsername, 
        offer, 
        caller: username, 
        isVideo: false 
      });
    } catch (err) {
      console.error('Error starting call:', err);
      alert('Could not start call: ' + err.message);
      endCall();
    }
  };

  // Video call
  const startVideoCall = async (targetUsername) => {
    try {
      // Close any existing connection first
      closeExistingConnection();
      
      setInCall(true);
      setCurrentCallPeer(targetUsername);
      setCallType('video');
      
      peerRef.current = new window.RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pendingCandidatesRef.current = [];
      remoteStreamRef.current = new MediaStream();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localAudioRef.current.srcObject = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try { await localVideoRef.current.play(); } catch (e) { /* ignore autoplay */ }
      }
      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate && targetUsername) {
          socketRef.current.emit('ice-candidate', { targetId: targetUsername, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = e.streams[0];
            if (remoteVideoRef.current.play) { remoteVideoRef.current.play().catch(() => {}); }
          }
        } else {
          if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
          remoteStreamRef.current.addTrack(e.track);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
            if (remoteVideoRef.current.play) { remoteVideoRef.current.play().catch(() => {}); }
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStreamRef.current;
            if (remoteAudioRef.current.play) { remoteAudioRef.current.play().catch(() => {}); }
          }
        }
      };

      peerRef.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerRef.current.connectionState);
        if (peerRef.current.connectionState === 'failed' || 
            peerRef.current.connectionState === 'disconnected') {
          endCall();
        }
      };

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      socketRef.current.emit('call-user', { 
        targetId: targetUsername, 
        offer, 
        caller: username, 
        isVideo: true 
      });
    } catch (err) {
      console.error('Error starting video call:', err);
      alert('Could not start video call: ' + err.message);
      endCall();
    }
  };

  // Call handling
  const handleIncomingCall = useCallback(({ from, offer, caller, isVideo }) => {
    setIncomingCall({ from, offer, caller, isVideo });
  }, []);

  const acceptCall = async () => {
    if (!incomingCall) return;
    setInCall(true);
    setCurrentCallPeer(incomingCall.from);
    setCallType(incomingCall.isVideo ? 'video' : 'audio');
    setIncomingCall(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.isVideo
      });
      
      localAudioRef.current.srcObject = stream;
      if (incomingCall.isVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try { await localVideoRef.current.play(); } catch (e) { /* ignore autoplay */ }
      }
      
      peerRef.current = new window.RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      stream.getTracks().forEach(track => peerRef.current.addTrack(track, stream));
      pendingCandidatesRef.current = [];
      remoteStreamRef.current = new MediaStream();

      peerRef.current.onicecandidate = (e) => {
        if (e.candidate) {
          socketRef.current.emit('ice-candidate', { targetId: incomingCall.from, candidate: e.candidate });
        }
      };

      peerRef.current.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
          if (incomingCall.isVideo && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = e.streams[0];
            if (remoteVideoRef.current.play) { remoteVideoRef.current.play().catch(() => {}); }
          }
        } else {
          if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
          remoteStreamRef.current.addTrack(e.track);
          if (incomingCall.isVideo && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
            if (remoteVideoRef.current.play) { remoteVideoRef.current.play().catch(() => {}); }
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStreamRef.current;
            if (remoteAudioRef.current.play) { remoteAudioRef.current.play().catch(() => {}); }
          }
        }
      };

      peerRef.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerRef.current.connectionState);
        if (peerRef.current.connectionState === 'failed' || 
            peerRef.current.connectionState === 'disconnected') {
          endCall();
        }
      };

      await peerRef.current.setRemoteDescription(new window.RTCSessionDescription(incomingCall.offer));

      // Flush any queued ICE candidates now that remote description is set
      if (pendingCandidatesRef.current.length) {
        try {
          await Promise.all(
            pendingCandidatesRef.current.map(c => peerRef.current.addIceCandidate(new window.RTCIceCandidate(c)))
          );
        } finally {
          pendingCandidatesRef.current = [];
        }
      }

      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socketRef.current.emit('answer-call', { targetId: incomingCall.from, answer });
    } catch (err) {
      alert('Could not answer call: ' + err.message);
      setInCall(false);
      setCurrentCallPeer(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      socketRef.current.emit('reject-call', { targetId: incomingCall.from });
      setIncomingCall(null);
    }
  };

  const handleCallAnswered = async ({ answer }) => {
    if (peerRef.current) {
      await peerRef.current.setRemoteDescription(new window.RTCSessionDescription(answer));
      // Flush any queued ICE candidates now that remote description is set
      if (pendingCandidatesRef.current.length) {
        try {
          await Promise.all(
            pendingCandidatesRef.current.map(c => peerRef.current.addIceCandidate(new window.RTCIceCandidate(c)))
          );
        } finally {
          pendingCandidatesRef.current = [];
        }
      }
    }
  };

  const handleICECandidate = async ({ candidate }) => {
    try {
      if (!peerRef.current) return;
      // Queue candidates until remote description is set
      if (!peerRef.current.remoteDescription || !peerRef.current.remoteDescription.type) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      await peerRef.current.addIceCandidate(new window.RTCIceCandidate(candidate));
    } catch (e) {
      console.error('ICE Error:', e);
    }
  };

  // Socket connection and listeners
  useEffect(() => {
    const token = localStorage.getItem('token');
    const uname = (localStorage.getItem('username') || '').trim();
    const userRole = localStorage.getItem('role');

    if (!token || !uname) {
      navigate('/');
      return;
    }

    setUsername(uname);
    setRole(userRole);

    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    socketRef.current = io('https://chatroom1-6.onrender.com', { 
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
    socketRef.current.connect();

    socketRef.current.on('connect', () => {
      socketRef.current.emit('register-user', uname);
    });

    // Enhanced event listeners
    socketRef.current.on('loadMessages', handleLoadMessages);
    socketRef.current.on('chatMessage', handleIncomingMessage);
    socketRef.current.on('chatFile', handleIncomingMessage);
    socketRef.current.on('deleteMessage', handleDeletedMessage);
    socketRef.current.on('user-joined', handleUserJoined);
    socketRef.current.on('user-left', handleUserLeft);
    socketRef.current.on('online-users', handleOnlineUsers);
    socketRef.current.on('typing-start', handleTypingStart);
    socketRef.current.on('typing-stop', handleTypingStop);
    socketRef.current.on('reaction-added', handleReaction);
    
    // Call events
    socketRef.current.on('incoming-call', handleIncomingCall);
    socketRef.current.on('call-answered', handleCallAnswered);
    socketRef.current.on('ice-candidate', handleICECandidate);
    socketRef.current.on('call-rejected', () => {
      endCall();
      alert('Call was rejected.');
    });
    socketRef.current.on('end-call', () => {
      endCall();
      alert('The other user ended the call.');
    });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socketRef.current?.disconnect();
    };
  }, [navigate, handleLoadMessages, handleIncomingMessage, handleDeletedMessage, 
      handleUserJoined, handleUserLeft, handleOnlineUsers, handleTypingStart, 
      handleTypingStop, handleReaction, handleIncomingCall, endCall]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Send message with typing indicator
  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (!socketRef.current?.connected) return;
    
    const chatMessage = { 
      sender: username, 
      content: message.trim(), 
      type: 'text',
      timestamp: new Date().toISOString()
    };
    
    socketRef.current.emit('chatMessage', chatMessage);
    setMessage('');
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      socketRef.current.emit('typing-stop', { username });
    }
  };

  const deleteMessage = (messageId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      socketRef.current.emit('deleteMessage', messageId);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const onEmojiClick = (emojiObject) => {
    setMessage((prev) => prev + emojiObject.emoji);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const reactions = [
    { emoji: '❤️', name: 'heart' },
    { emoji: '👍', name: 'thumbs_up' },
    { emoji: '😂', name: 'laugh' },
    { emoji: '😢', name: 'sad' },
    { emoji: '😠', name: 'angry' },
    { emoji: '😮', name: 'surprise' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
      </div>

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Enhanced Header */}
        <div className="flex justify-between items-center mb-6 bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <img src="/logo.png" alt="logo" className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                KSC Chat
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-300">Welcome back, {username}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Enhanced online users */}
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg hover:bg-white/20 transition-all duration-200 relative"
            >
              <FaUsers className="text-green-400" />
              <span className="text-white text-sm">{connectedUsers.length + 1} online</span>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </button>
            
            {role === 'admin' && (
              <button 
                onClick={() => navigate('/admin-dashboard')} 
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <FaCrown className="text-sm" />
                Admin
              </button>
            )}
            
            <button 
              onClick={() => { setShowCallOptions(true); setCallType('audio'); }} 
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <FaPhone className="text-sm" />
              Call
            </button>
            
            <button 
              onClick={() => { setShowCallOptions(true); setCallType('video'); }} 
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <FaVideo className="text-sm" />
              Video
            </button>
            
            <button 
              onClick={handleLogout} 
              className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <FaSignOutAlt className="text-sm" />
              Logout
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Enhanced User List Sidebar */}
          {showUserList && (
            <div className="w-80 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-4 animate-slideIn">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FaUsers className="text-green-400" />
                Online Users ({connectedUsers.length + 1})
              </h3>
              
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
                {/* Current user */}
                <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{username} (You)</p>
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <FaCircle className="text-xs" />
                      Online
                    </p>
                  </div>
                  {role === 'admin' && <FaCrown className="text-amber-400" />}
                </div>

                {/* Other users */}
                {connectedUsers.map((user, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-200 group">
                    <div className="relative">
                      <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {user.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{user}</p>
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <FaCircle className="text-xs" />
                        Online
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startCall(user)}
                        className="p-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                        title="Audio call"
                      >
                        <FaPhone className="text-xs text-white" />
                      </button>
                      <button
                        onClick={() => startVideoCall(user)}
                        className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                        title="Video call"
                      >
                        <FaVideo className="text-xs text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Chat Container */}
          <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Chat Messages */}
            <div className="h-[500px] overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {chat.map((msg, i) => {
                const isMe = msg.sender === username;
                const isAdmin = role === 'admin';
                const canDelete = isMe || isAdmin;
                const isSystem = msg.type === 'system';
                let fileData = null;

                if (msg.type === 'file') {
                  try {
                    fileData = JSON.parse(msg.content);
                  } catch {}
                }

                if (isSystem) {
                  return (
                    <div key={msg._id || `system-${i}`} className="flex justify-center">
                      <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-gray-300 text-sm">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg._id || `${msg.sender}-${msg.timestamp}-${i}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn group`}>
                    <div className={`relative max-w-xs lg:max-w-md ${isMe ? 'order-2' : 'order-1'}`}>
                      {/* Avatar */}
                      {!isMe && (
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-bold mb-1">
                          {msg.sender.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div className={`relative p-4 rounded-2xl shadow-lg ${
                        isMe 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white ml-4' 
                          : 'bg-white/20 backdrop-blur-sm text-white border border-white/20 mr-4'
                      }`}>
                        {/* Sender name for others */}
                        {!isMe && (
                          <div className="text-xs font-semibold text-gray-300 mb-1">{msg.sender}</div>
                        )}
                        
                        {/* Message content */}
                        {msg.type === 'file' && fileData ? (
                          <div className="space-y-2">
                            {fileData.type.startsWith('image/') ? (
                              <img 
                                src={fileData.data} 
                                alt="shared" 
                                className="rounded-lg max-w-full h-auto shadow-md cursor-pointer hover:scale-105 transition-transform" 
                                onClick={() => window.open(fileData.data, '_blank')}
                              />
                            ) : fileData.type.startsWith('video/') ? (
                              <video 
                                controls 
                                className="rounded-lg max-w-full h-auto shadow-md"
                              >
                                <source src={fileData.data} type={fileData.type} />
                              </video>
                            ) : (
                              <a 
                                href={fileData.data} 
                                download={fileData.name} 
                                className="flex items-center gap-2 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                              >
                                <FaPaperclip className="text-cyan-400" />
                                <div className="flex-1">
                                  <p className="truncate font-medium">{fileData.name}</p>
                                  <p className="text-xs opacity-70">{formatFileSize(fileData.size)}</p>
                                </div>
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm leading-relaxed">{msg.content}</div>
                        )}
                        
                        {/* Message reactions */}
                        {messageReactions[msg._id] && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(messageReactions[msg._id]).map(([reaction, users]) => (
                              <button
                                key={reaction}
                                className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full text-xs hover:bg-white/30 transition-colors"
                                title={users.join(', ')}
                              >
                                <span>{reactions.find(r => r.name === reaction)?.emoji}</span>
                                <span>{users.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Timestamp and actions */}
                        <div className="flex items-center justify-between mt-2">
                          <div className={`text-xs ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                            {msg.timestamp ? getTimeAgo(msg.timestamp) : ''}
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Reaction button */}
                            <button
                              onClick={() => setShowReactionPicker(showReactionPicker === msg._id ? null : msg._id)}
                              className="p-1 hover:bg-white/20 rounded transition-colors"
                              title="Add reaction"
                            >
                              <FaSmile className="text-xs" />
                            </button>
                            
                            {/* Delete button */}
                            {canDelete && msg._id && (
                              <button 
                                onClick={() => deleteMessage(msg._id)} 
                                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                title="Delete message"
                              >
                                <FaTrashAlt className="text-xs" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Reaction picker */}
                        {showReactionPicker === msg._id && (
                          <div className="absolute bottom-full mb-2 left-0 bg-white/90 backdrop-blur-sm rounded-lg p-2 flex gap-1 shadow-lg border border-white/20 z-10">
                            {reactions.map((reaction) => (
                              <button
                                key={reaction.name}
                                onClick={() => addReaction(msg._id, reaction.name)}
                                className="p-2 hover:bg-white/20 rounded transition-colors text-lg"
                                title={reaction.name}
                              >
                                {reaction.emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/20 mr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-200"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce animation-delay-400"></div>
                      </div>
                      <span className="text-sm text-gray-300">
                        {typingUsers.length === 1 
                          ? `${typingUsers[0]} is typing...`
                          : `${typingUsers.length} people are typing...`
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef}></div>
            </div>

            {/* Enhanced Message Input */}
            <div className="p-4 border-t border-white/20">
              <form onSubmit={sendMessage} className="flex items-center gap-3">
                {/* File upload */}
                <label htmlFor="fileInput" className="cursor-pointer p-2 hover:bg-white/10 rounded-lg transition-colors group">
                  <FaPaperclip className="text-gray-300 group-hover:text-white transition-colors" />
                  <input 
                    id="fileInput" 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,image/*,video/*,audio/*,.doc,.docx,.txt" 
                    onChange={(e) => handleFileUpload(e.target.files[0])} 
                  />
                </label>
                
                {/* Emoji picker */}
                <div className="relative">
                  <button 
                    type="button" 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                  >
                    <FaSmile className="text-gray-300 group-hover:text-white transition-colors" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 z-50">
                      <Picker onEmojiClick={onEmojiClick} />
                    </div>
                  )}
                </div>
                
                {/* Message input */}
                <input 
                  type="text" 
                  value={message} 
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type your message..." 
                  className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
                
                {/* Send button */}
                <button 
                  type="submit" 
                  className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!message.trim()}
                >
                  <FaPaperPlane className="text-white" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Call Options Modal */}
        {showCallOptions && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md w-full mx-4 animate-scaleIn">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  Start {callType === 'video' ? 'Video' : 'Audio'} Call
                </h3>
                <button 
                  onClick={() => setShowCallOptions(false)}
                  className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  ✕
                </button>
              </div>
              
              {connectedUsers.length === 0 ? (
                <div className="text-center py-8">
                  <FaUsers className="text-4xl text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-300">No users online to call</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
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
                      className="w-full flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 text-white hover:scale-105 group"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                        {user.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{user}</p>
                        <p className="text-sm text-gray-300">
                          {callType === 'video' ? 'Start video call' : 'Start audio call'}
                        </p>
                      </div>
                      <div className="text-xl group-hover:scale-110 transition-transform">
                        {callType === 'video' ? <FaVideo /> : <FaPhone />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Call Controls */}
        {inCall && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="flex items-center gap-4 bg-black/80 backdrop-blur-lg rounded-2xl px-6 py-4 border border-white/20 shadow-2xl">
              <div className="text-white text-sm flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                {callType === 'video' ? 'Video call' : 'Audio call'} with {currentCallPeer}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Mute button */}
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-lg transition-all duration-200 ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <FaMicrophoneSlash className="text-white" /> : <FaMicrophone className="text-white" />}
                </button>

                {/* Video toggle (only for video calls) */}
                {callType === 'video' && (
                  <>
                    <button
                      onClick={toggleVideo}
                      className={`p-3 rounded-lg transition-all duration-200 ${
                        isVideoOff 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-white/20 hover:bg-white/30'
                      }`}
                      title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                    >
                      {isVideoOff ? <FaVideoSlash className="text-white" /> : <FaVideo className="text-white" />}
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200"
                      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                      {isFullscreen ? <FaCompress className="text-white" /> : <FaExpand className="text-white" />}
                    </button>
                  </>
                )}

                {/* End call button */}
                <button
                  onClick={endCall}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <FaPhoneSlash />
                  End Call
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Video call screens */}
        {inCall && callType === 'video' && (
          <div className={`fixed ${isFullscreen ? 'inset-0 bg-black z-40' : 'bottom-24 left-1/2 transform -translate-x-1/2 z-40'}`}>
            <div className={`flex gap-4 ${isFullscreen ? 'h-full items-center justify-center' : ''}`}>
              <div className={`bg-black/80 backdrop-blur-lg rounded-xl p-2 border border-white/20 ${isFullscreen ? 'w-1/2 h-3/4' : ''}`}>
                <div className="text-white text-xs text-center mb-1">You</div>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`rounded-lg bg-gray-800 ${isFullscreen ? 'w-full h-full object-cover' : 'w-40 h-30'}`}
                />
              </div>
              <div className={`bg-black/80 backdrop-blur-lg rounded-xl p-2 border border-white/20 ${isFullscreen ? 'w-1/2 h-3/4' : ''}`}>
                <div className="text-white text-xs text-center mb-1">Remote</div>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`rounded-lg bg-gray-800 ${isFullscreen ? 'w-full h-full object-cover' : 'w-40 h-30'}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Audio elements */}
        <audio ref={localAudioRef} autoPlay muted className="hidden" />
        <audio ref={remoteAudioRef} autoPlay className="hidden" />

        {/* Incoming call popup */}
        {incomingCall && (
          <CallPopup
            caller={incomingCall.caller}
            onAccept={acceptCall}
            onReject={rejectCall}
          />
        )}
      </div>
    </div>
  );
}

export default ChatRoom;
