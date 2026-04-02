import { useState, useEffect } from 'react';
import { getMembers, adminGetUsers, addMember, removeMember } from '../api';

export default function MemberList({ groupId }) {
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
        if (groupId) {
            loadMembers();
            loadAllUsers();
        }
    }, [groupId]);

    const loadMembers = async () => {
        try {
            const res = await getMembers(groupId);
            setMembers(res.data);
        } catch (err) { console.error(err); }
    };

    const loadAllUsers = async () => {
        try {
            const res = await adminGetUsers();
            setAllUsers(res.data);
        } catch (err) { console.error(err); }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!selectedUserId) return;
        try {
            await addMember(groupId, { user_id: parseInt(selectedUserId) });
            setSelectedUserId('');
            loadMembers();
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to add member');
        }
    };

    const handleRemove = async (userId) => {
        if (!confirm('Remove member?')) return;
        try {
            await removeMember(groupId, userId);
            loadMembers();
        } catch (err) {
            alert('Failed to remove member');
        }
    };

    const availableUsers = allUsers.filter(u => !members.find(m => m.user_id === u.id));

    return (
        <div className="glass-card">
            <h3>Manage Members</h3>
            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                <select
                    className="form-control"
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                >
                    <option value="">Select User to Add...</option>
                    {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                    ))}
                </select>
                <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>Add</button>
            </form>

            {members.length === 0 && <p className="text-muted">No members yet.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {members.map(m => (
                    <li key={m.id} className="flex items-center" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>{m.user.username} <span className="text-muted" style={{ fontSize: '0.85rem' }}>({m.user.email})</span></span>
                        <button className="btn btn-ghost" onClick={() => handleRemove(m.user_id)}>Remove</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
