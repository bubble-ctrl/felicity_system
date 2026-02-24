import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { messageAPI } from '../services/api';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'];

const DiscussionForum = ({ eventId, isOrganizer }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMsg, setNewMsg] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [replies, setReplies] = useState({});
    const [openThread, setOpenThread] = useState(null);
    const [isAnnouncement, setIsAnnouncement] = useState(false);
    const [loading, setLoading] = useState(true);
    const [newCount, setNewCount] = useState(0);
    const [showEmojiFor, setShowEmojiFor] = useState(null);
    const socketRef = useRef(null);
    const bottomRef = useRef(null);
    const listRef = useRef(null);

    // Load messages
    const loadMessages = useCallback(async () => {
        try {
            const { data } = await messageAPI.getMessages(eventId);
            setMessages(data.data.messages);
        } catch (e) { /* ignore */ }
        finally { setLoading(false); }
    }, [eventId]);

    // Track processed message IDs to prevent duplicates from StrictMode double-mount
    const processedMsgIds = useRef(new Set());
    // Notification ref
    const [notification, setNotification] = useState(null);

    // Socket.IO setup — with StrictMode-safe cleanup
    useEffect(() => {
        loadMessages();

        // Disconnect any existing socket before creating new one
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        const token = localStorage.getItem('token');
        const socket = io('https://felicity-backend-vqz2.onrender.com', { auth: { token } });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('joinEvent', eventId);
        });

        socket.on('newMessage', (msg) => {
            // StrictMode-safe deduplication using a ref
            if (processedMsgIds.current.has(msg._id)) return;
            processedMsgIds.current.add(msg._id);
            // Prevent set from growing indefinitely
            if (processedMsgIds.current.size > 500) {
                const arr = [...processedMsgIds.current];
                processedMsgIds.current = new Set(arr.slice(-200));
            }

            setMessages((prev) => {
                if (msg.parentId) {
                    // It's a reply — update replies state (deduplicate)
                    setReplies((pr) => {
                        const existing = pr[msg.parentId] || [];
                        if (existing.some((r) => r._id === msg._id)) return pr;
                        return { ...pr, [msg.parentId]: [...existing, msg] };
                    });
                    // Update reply count in parent
                    return prev.map((m) =>
                        m._id === msg.parentId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
                    );
                }
                // Check if already exists in messages
                if (prev.some((m) => m._id === msg._id)) return prev;

                // Show notification for messages from other users
                const senderName = msg.userId?.firstName || msg.userId?.organizerName || 'Someone';
                if (msg.userId?._id !== user?.id) {
                    setNotification(`💬 ${senderName}: ${msg.content.slice(0, 50)}${msg.content.length > 50 ? '…' : ''}`);
                    setTimeout(() => setNotification(null), 4000);
                }

                setNewCount((c) => c + 1);
                return [msg, ...prev];
            });
        });

        socket.on('messageDeleted', ({ messageId }) => {
            setMessages((prev) => prev.filter((m) => m._id !== messageId));
            setReplies((prev) => {
                const updated = { ...prev };
                // Remove from replies too
                for (const key of Object.keys(updated)) {
                    updated[key] = updated[key].filter((r) => r._id !== messageId);
                }
                return updated;
            });
        });

        socket.on('messagePinned', ({ messageId, pinned }) => {
            setMessages((prev) =>
                prev.map((m) => (m._id === messageId ? { ...m, pinned } : m))
                    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.createdAt) - new Date(a.createdAt))
            );
        });

        socket.on('messageReaction', ({ messageId, reactions }) => {
            setMessages((prev) =>
                prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
            );
            setReplies((prev) => {
                const updated = { ...prev };
                for (const key of Object.keys(updated)) {
                    updated[key] = updated[key].map((r) =>
                        r._id === messageId ? { ...r, reactions } : r
                    );
                }
                return updated;
            });
        });

        return () => {
            socket.emit('leaveEvent', eventId);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [eventId, loadMessages]);

    // Send message
    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMsg.trim()) return;
        try {
            await messageAPI.createMessage(eventId, {
                content: newMsg.trim(),
                parentId: replyTo || undefined,
                type: isAnnouncement ? 'announcement' : 'message',
            });
            setNewMsg('');
            setReplyTo(null);
            setIsAnnouncement(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send message');
        }
    };

    // Load thread replies
    const toggleThread = async (msgId) => {
        if (openThread === msgId) { setOpenThread(null); return; }
        setOpenThread(msgId);
        // Always re-fetch replies from API to avoid duplication
        try {
            const { data } = await messageAPI.getReplies(msgId);
            setReplies((prev) => ({ ...prev, [msgId]: data.data.replies }));
        } catch (e) { /* ignore */ }
    };

    // Delete message
    const handleDelete = async (msgId) => {
        if (!window.confirm('Delete this message?')) return;
        try { await messageAPI.deleteMessage(msgId); } catch (e) { /* ignore */ }
    };

    // Pin message
    const handlePin = async (msgId) => {
        try { await messageAPI.togglePin(msgId); } catch (e) { /* ignore */ }
    };

    // React
    const handleReact = async (msgId, emoji) => {
        try { await messageAPI.react(msgId, { emoji }); } catch (e) { /* ignore */ }
        setShowEmojiFor(null);
    };

    // Format reactions
    const renderReactions = (msg) => {
        const r = msg.reactions;
        if (!r) return null;
        // r could be a Map serialized as an object
        const entries = r instanceof Map ? Array.from(r.entries()) : Object.entries(r);
        const active = entries.filter(([, v]) => {
            const count = typeof v === 'number' ? v : (Array.isArray(v) ? v.length : 0);
            return count > 0;
        });
        if (!active.length) return null;
        return (
            <div className="forum-reactions">
                {active.map(([emoji, v]) => (
                    <button key={emoji} className="reaction-chip" onClick={() => handleReact(msg._id, emoji)}>
                        {emoji} {typeof v === 'number' ? v : (Array.isArray(v) ? v.length : 0)}
                    </button>
                ))}
            </div>
        );
    };

    const getUserName = (u) => {
        if (!u) return 'Unknown';
        if (u.organizerName) return u.organizerName;
        return [u.firstName, u.lastName].filter(Boolean).join(' ') || 'User';
    };

    const renderMessage = (msg, isReply = false) => (
        <div key={msg._id} className={`forum-message ${msg.pinned ? 'pinned' : ''} ${msg.type === 'announcement' ? 'announcement' : ''} ${isReply ? 'reply' : ''}`}>
            <div className="msg-header">
                <span className="msg-author">{getUserName(msg.userId)}</span>
                {msg.userId?.role === 'organizer' && <span className="msg-role-badge organizer">Organizer</span>}
                {msg.type === 'announcement' && <span className="msg-role-badge announcement">📢 Announcement</span>}
                {msg.pinned && <span className="msg-role-badge pinned">📌 Pinned</span>}
                <span className="msg-time">{new Date(msg.createdAt).toLocaleString()}</span>
            </div>
            <div className="msg-content">{msg.content}</div>
            <div className="msg-actions">
                {renderReactions(msg)}
                <div className="msg-action-buttons">
                    <button className="msg-action-btn" onClick={() => setShowEmojiFor(showEmojiFor === msg._id ? null : msg._id)} title="React">😊</button>
                    {!isReply && (
                        <button className="msg-action-btn" onClick={() => { setReplyTo(msg._id); }} title="Reply">
                            💬 {msg.replyCount > 0 && <span className="reply-count">{msg.replyCount}</span>}
                        </button>
                    )}
                    {isOrganizer && !isReply && (
                        <button className="msg-action-btn" onClick={() => handlePin(msg._id)} title={msg.pinned ? 'Unpin' : 'Pin'}>📌</button>
                    )}
                    {(isOrganizer || msg.userId?._id === user?.id) && (
                        <button className="msg-action-btn delete" onClick={() => handleDelete(msg._id)} title="Delete">🗑️</button>
                    )}
                </div>
                {showEmojiFor === msg._id && (
                    <div className="emoji-picker">
                        {EMOJIS.map((e) => <button key={e} onClick={() => handleReact(msg._id, e)}>{e}</button>)}
                    </div>
                )}
            </div>
            {/* Thread */}
            {!isReply && msg.replyCount > 0 && (
                <button className="thread-toggle" onClick={() => toggleThread(msg._id)}>
                    {openThread === msg._id ? '▾ Hide replies' : `▸ View ${msg.replyCount} ${msg.replyCount === 1 ? 'reply' : 'replies'}`}
                </button>
            )}
            {!isReply && openThread === msg._id && replies[msg._id] && (
                <div className="thread-replies">
                    {replies[msg._id].map((r) => renderMessage(r, true))}
                </div>
            )}
        </div>
    );

    if (loading) return <div className="forum-loading">Loading discussion...</div>;

    return (
        <div className="discussion-forum">
            {/* Notification toast */}
            {notification && (
                <div style={{
                    position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999,
                    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff',
                    padding: '0.8rem 1.2rem', borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(108,92,231,0.4)',
                    fontSize: '0.9rem', maxWidth: '350px', animation: 'slideIn 0.3s ease',
                    cursor: 'pointer',
                }} onClick={() => setNotification(null)}>
                    {notification}
                </div>
            )}
            <div className="forum-header">
                <h3>💬 Discussion Forum</h3>
                {newCount > 0 && (
                    <button className="new-msg-badge" onClick={() => { setNewCount(0); loadMessages(); }}>
                        {newCount} new message{newCount > 1 ? 's' : ''} ↑
                    </button>
                )}
            </div>

            {/* Compose */}
            <form className="forum-compose" onSubmit={handleSend}>
                {replyTo && (
                    <div className="reply-indicator">
                        Replying to message… <button type="button" onClick={() => setReplyTo(null)}>✕</button>
                    </div>
                )}
                <div className="compose-row">
                    <input
                        type="text"
                        placeholder={replyTo ? 'Write a reply…' : 'Type a message…'}
                        value={newMsg}
                        onChange={(e) => setNewMsg(e.target.value)}
                        maxLength={2000}
                    />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={!newMsg.trim()}>Send</button>
                </div>
                {isOrganizer && !replyTo && (
                    <label className="announce-toggle">
                        <input type="checkbox" checked={isAnnouncement} onChange={(e) => setIsAnnouncement(e.target.checked)} />
                        Post as announcement
                    </label>
                )}
            </form>

            {/* Messages */}
            <div className="forum-messages" ref={listRef}>
                {messages.length === 0 ? (
                    <div className="forum-empty">No messages yet. Start the conversation! 🎉</div>
                ) : (
                    messages.map((msg) => renderMessage(msg))
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default DiscussionForum;
