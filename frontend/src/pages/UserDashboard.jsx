import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getAllUsers, getFriendships, sendFriendRequest, acceptFriendRequest,
    getMyGroups, createGroup, addMember, getEligibleFriends
} from '../api';
import { useAuth } from '../context/AuthContext';

export default function UserDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [friendships, setFriendships] = useState([]);
    const [groups, setGroups] = useState([]);

    // Group creation state
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');

    // Post-creation: add friends to new group
    const [newGroupId, setNewGroupId] = useState(null);
    const [newGroupFriends, setNewGroupFriends] = useState([]);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [uRes, fRes, gRes] = await Promise.all([
                getAllUsers(),
                getFriendships(),
                getMyGroups()
            ]);
            // Backend already filters admin users but double-filter on client side
            setUsers(uRes.data.filter(u => u.role !== 'admin'));
            setFriendships(fRes.data);
            setGroups(gRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddFriend = async (addresseeId) => {
        try {
            await sendFriendRequest({ addressee_id: addresseeId });
            loadData();
        } catch (err) { alert('Failed to send friend request'); }
    };

    const handleAcceptFriend = async (friendshipId) => {
        try {
            await acceptFriendRequest(friendshipId);
            loadData();
        } catch (err) { alert('Failed to accept'); }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            const res = await createGroup({ name: newGroupName, description: newGroupDesc });
            const created = { group_id: res.data.id, group_name: res.data.name };
            setGroups([...groups, created]);
            setNewGroupName('');
            setNewGroupDesc('');

            // Load eligible friends for this brand-new group
            const fRes = await getEligibleFriends(res.data.id);
            setNewGroupId(res.data.id);
            setNewGroupFriends(fRes.data);
        } catch (err) { alert('Failed to create group'); }
    };

    const handleAddToNewGroup = async (friendId) => {
        try {
            await addMember(newGroupId, { user_id: friendId });
            setNewGroupFriends(prev => prev.filter(f => f.id !== friendId));
        } catch (err) { alert('Failed to add member'); }
    };

    const getFriendshipStatus = (otherUserId) => {
        const found = friendships.find(f => f.requester_id === otherUserId || f.addressee_id === otherUserId);
        if (!found) return 'none';
        if (found.status === 'accepted') return 'friend';
        if (found.requester_id === user?.id) return 'sent';
        return 'received';
    };

    return (
        <div className="container mt-4 flex gap-4" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '300px' }}>
                <div className="glass-card mb-4">
                    <h3>My Groups</h3>
                    {groups.length === 0 ? <p className="text-muted">You have no groups yet.</p> : (
                        <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
                            {groups.map(g => (
                                <div key={g.group_id}
                                    onClick={() => navigate(`/groups/${g.group_id}`)}
                                    style={{ background: 'var(--bg-card)', padding: '15px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)', flex: 1, minWidth: '180px' }}>
                                    <h4 style={{ margin: '0 0 8px 0' }}>{g.group_name}</h4>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Click to view →</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="glass-card">
                    <h3>Create a Group</h3>
                    <form onSubmit={handleCreateGroup} className="flex gap-4 items-center">
                        <input
                            type="text"
                            placeholder="Group Name"
                            className="form-control"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Description (optional)"
                            className="form-control"
                            value={newGroupDesc}
                            onChange={(e) => setNewGroupDesc(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Create</button>
                    </form>

                    {/* Post-creation: invite friends */}
                    {newGroupId && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                            <h4 style={{ margin: '0 0 10px 0' }}>Add Friends to your new group</h4>
                            {newGroupFriends.length === 0 ? (
                                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                                    No more friends to add (or you have no friends yet — go add some!).{' '}
                                    <span
                                        style={{ color: 'var(--secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                                        onClick={() => { setNewGroupId(null); navigate(`/groups/${newGroupId}`); }}
                                    >Open group →</span>
                                </p>
                            ) : (
                                <>
                                    {newGroupFriends.map(f => (
                                        <div key={f.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                            <strong>{f.username}</strong>
                                            <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.85rem' }} onClick={() => handleAddToNewGroup(f.id)}>
                                                Add
                                            </button>
                                        </div>
                                    ))}
                                    <button className="btn btn-ghost" style={{ marginTop: '12px', fontSize: '0.85rem' }} onClick={() => { setNewGroupId(null); navigate(`/groups/${newGroupId}`); }}>
                                        Done — open group →
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, minWidth: '280px' }}>
                <div className="glass-card">
                    <h3>Community</h3>
                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {users.map(u => {
                            const status = getFriendshipStatus(u.id);
                            return (
                                <div key={u.id} className="flex items-center" style={{ justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                                    <div>
                                        <strong>{u.username}</strong>
                                    </div>
                                    <div>
                                        {status === 'none' && <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleAddFriend(u.id)}>Add Friend</button>}
                                        {status === 'sent' && <span className="text-muted" style={{ fontSize: '0.8rem' }}>Pending</span>}
                                        {status === 'received' && (
                                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'var(--success)' }}
                                                onClick={() => {
                                                    const f = friendships.find(fr => fr.requester_id === u.id);
                                                    handleAcceptFriend(f.id);
                                                }}>Accept</button>
                                        )}
                                        {status === 'friend' && <span className="text-secondary" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Friends ✓</span>}
                                    </div>
                                </div>
                            );
                        })}
                        {users.length === 0 && <p className="text-muted">No other users found.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
